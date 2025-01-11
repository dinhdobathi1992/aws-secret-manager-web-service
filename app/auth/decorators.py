from functools import wraps
from flask import session, redirect, url_for, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def require_group(group_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user' not in session:
                return redirect(url_for('auth.login'))

            user_groups = session.get('user', {}).get('groups', [])
            current_app.logger.info(f"User groups: {user_groups}")
            current_app.logger.info(f"Required group: {group_name}")

            if not user_groups:
                current_app.logger.warning("No groups found in user session")
                return {'message': 'No group memberships found'}, 403

            if group_name not in user_groups:
                current_app.logger.warning(f"User not in required group: {group_name}")
                return {'message': f'User must be a member of {group_name}'}, 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator