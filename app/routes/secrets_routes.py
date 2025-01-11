from flask import Blueprint, jsonify, request, render_template, session, redirect, url_for, current_app
from ..auth.decorators import login_required, require_group
from ..aws.secrets_manager import SecretsManager

secrets_bp = Blueprint('secrets', __name__)

@secrets_bp.route('/account/<account_id>')
@login_required
@require_group('secrets-readers')
def select_account(account_id):
    if account_id in current_app.config['AWS_ACCOUNTS']:
        session['current_account'] = account_id
        return redirect(url_for('secrets.list_secrets'))
    return {"error": "Invalid account"}, 400

@secrets_bp.route('/secrets')
@login_required
@require_group('secrets-readers')
def list_secrets():
    account_id = session.get('current_account', 'development')
    accounts = current_app.config['AWS_ACCOUNTS']
    current_app.logger.debug(f"Available accounts: {accounts}")
    try:
        secrets_manager = SecretsManager(account_id)
        secrets = secrets_manager.list_secrets()
        return render_template('secrets/list.html',
                            secrets=secrets,
                            accounts=accounts,
                            current_account=account_id)
    except Exception as e:
        return render_template('secrets/list.html',
                             error=str(e),
                             accounts=accounts,
                             current_account=account_id)

@secrets_bp.route('/secrets/<secret_name>')
@login_required
@require_group('secrets-readers')
def get_secret(secret_name):
    account_id = session.get('current_account', 'development')
    try:
        secrets_manager = SecretsManager(account_id)
        secret = secrets_manager.get_secret(secret_name)
        if secret is None:
            return jsonify({"error": f"Secret {secret_name} not found"}), 404
        return jsonify(secret)
    except Exception as e:
        current_app.logger.error(f"Error fetching secret: {str(e)}")
        return jsonify({"error": str(e)}), 500

@secrets_bp.route('/secrets/<secret_name>', methods=['PUT'])
@login_required
@require_group('secrets-writers')
def update_secret(secret_name):
    account_id = session.get('current_account', 'development')
    try:
        secret_value = request.get_json()
        if secret_value is None:
            return jsonify({"error": "Invalid JSON data"}), 400

        secrets_manager = SecretsManager(account_id)
        result = secrets_manager.update_secret(secret_name, secret_value)

        if result:
            return jsonify({'success': True, 'message': 'Secret updated successfully'})
        return jsonify({"error": "Failed to update secret"}), 500
    except Exception as e:
        current_app.logger.error(f"Error updating secret: {str(e)}")
        return jsonify({"error": str(e)}), 500

@secrets_bp.route('/secrets', methods=['POST'])
@login_required
@require_group('secrets-writers')
def create_secret():
    account_id = session.get('current_account', 'development')
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'value' not in data:
            return jsonify({"error": "Missing required fields"}), 400

        secrets_manager = SecretsManager(account_id)
        description = f"Type: {data.get('type', 'other')}"
        result = secrets_manager.create_secret(
            name=data['name'],
            secret_value=data['value'],
            description=description
        )

        if result:
            return jsonify({'success': True, 'message': 'Secret created successfully'})
        return jsonify({"error": "Failed to create secret"}), 500
    except Exception as e:
        current_app.logger.error(f"Error creating secret: {str(e)}")
        return jsonify({"error": str(e)}), 500