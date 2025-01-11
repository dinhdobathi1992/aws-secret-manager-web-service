from flask import Flask
from flask_jwt_extended import JWTManager
from .config.settings import config
from .aws.secrets_manager import SecretsManager
import json

jwt = JWTManager()

def create_app(config_name='default'):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    jwt.init_app(app)

    # Register blueprints
    from .routes.main_routes import main_bp
    from .routes.auth_routes import auth_bp
    from .routes.secrets_routes import secrets_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(secrets_bp, url_prefix='/api')

    return app