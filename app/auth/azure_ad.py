from flask import current_app, url_for
from msal import ConfidentialClientApplication

class AzureAD:
    def __init__(self):
        self.client = ConfidentialClientApplication(
            current_app.config['AZURE_CLIENT_ID'],
            authority=current_app.config['AZURE_AUTHORITY'],
            client_credential=current_app.config['AZURE_CLIENT_SECRET']
        )

    def get_auth_url(self):
        """Generate Azure AD authentication URL"""
        redirect_uri = current_app.config['AZURE_REDIRECT_URI']
        print(f"Using redirect URI: {redirect_uri}")  # Debug print
        return self.client.get_authorization_request_url(
            scopes=current_app.config['AZURE_SCOPE'],
            redirect_uri=redirect_uri,
            response_type='code'
        )

    def get_token(self, auth_code):
        """Exchange authorization code for access token"""
        try:
            redirect_uri = current_app.config['AZURE_REDIRECT_URI']
            print(f"Token exchange with redirect URI: {redirect_uri}")  # Debug print
            result = self.client.acquire_token_by_authorization_code(
                code=auth_code,
                scopes=current_app.config['AZURE_SCOPE'],
                redirect_uri=redirect_uri
            )
            if 'error' in result:
                print(f"Token error: {result.get('error_description', 'Unknown error')}")
            return result
        except Exception as e:
            print(f"Token acquisition failed: {str(e)}")
            return {"error": "token_error", "error_description": str(e)}