from flask import Blueprint, redirect, session, url_for, request, current_app, jsonify
from ..auth.azure_ad import AzureAD
from flask_jwt_extended import create_access_token
from ..auth.decorators import login_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    try:
        azure_ad = AzureAD()
        auth_url = azure_ad.get_auth_url()
        return redirect(auth_url)
    except Exception as e:
        current_app.logger.error(f"Login failed: {str(e)}")
        return {"error": "login_failed", "message": str(e)}, 500

@auth_bp.route('/callback')
def callback():
    try:
        error = request.args.get('error')
        if error:
            return f"Authentication failed: {request.args.get('error_description')}", 400

        azure_ad = AzureAD()
        token = azure_ad.get_token(request.args['code'])

        if 'error' in token:
            return token['error_description'], 401

        # Debug print
        current_app.logger.info(f"Token claims: {token.get('id_token_claims')}")

        # Get user groups from token
        user_groups = token.get('id_token_claims', {}).get('groups', [])

        # Map Azure AD group IDs to application roles
        mapped_groups = []
        if user_groups:
            for role, group_id in current_app.config['ALLOWED_GROUPS'].items():
                if group_id in user_groups:
                    mapped_groups.append(role)

        # For development/testing, add default group if no groups found
        if not mapped_groups and current_app.config['DEBUG']:
            mapped_groups = ['secrets-readers']
            current_app.logger.warning("No groups found, using default group for development")

        # Store user information in session
        session['user'] = {
            'id': token.get('id_token_claims', {}).get('oid'),
            'name': token.get('id_token_claims', {}).get('name'),
            'email': token.get('id_token_claims', {}).get('preferred_username'),
            'groups': mapped_groups,
            'azure_groups': user_groups  # Store original Azure AD groups for reference
        }

        # Create JWT token and store in session
        access_token = create_access_token(
            identity=session['user']['id'],
            additional_claims={'groups': mapped_groups}
        )
        session['jwt_token'] = access_token

        return redirect(url_for('main.index'))
    except Exception as e:
        current_app.logger.error(f"Callback failed: {str(e)}")
        return {"error": "callback_failed", "message": str(e)}, 500

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.index'))

@auth_bp.route('/me')
@login_required
def me():
    return jsonify({
        'user': session.get('user'),
        'groups': session.get('user', {}).get('groups', [])
    })