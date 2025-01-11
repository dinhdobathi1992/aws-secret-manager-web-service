import os
from dotenv import load_dotenv
import json

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev')

    # Azure AD settings
    AZURE_CLIENT_ID = os.getenv('AZURE_CLIENT_ID')
    AZURE_CLIENT_SECRET = os.getenv('AZURE_CLIENT_SECRET')
    AZURE_TENANT_ID = os.getenv('AZURE_TENANT_ID')
    AZURE_AUTHORITY = f'https://login.microsoftonline.com/{os.getenv("AZURE_TENANT_ID")}'
    AZURE_REDIRECT_URI = os.getenv('AZURE_REDIRECT_URI', 'http://localhost:5001/auth/callback')
    AZURE_SCOPE = ['https://graph.microsoft.com/.default']

    # Azure AD Groups
    ALLOWED_GROUPS = {
        'secrets-readers': os.getenv('AZURE_GROUP_SECRETS_READERS'),
        'secrets-writers': os.getenv('AZURE_GROUP_SECRETS_WRITERS')
    }

    # AWS settings
    AWS_ACCOUNTS = json.loads(os.getenv('AWS_ACCOUNTS', '{}'))

class DevelopmentConfig(Config):
    DEBUG = True
    ENV = 'development'

class ProductionConfig(Config):
    DEBUG = False
    ENV = 'production'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}