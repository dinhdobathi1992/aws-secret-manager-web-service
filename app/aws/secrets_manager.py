import boto3
import json
from botocore.exceptions import ClientError
from flask import current_app, session

class SecretsManager:
    def __init__(self, account_id=None):
        self.account_id = account_id or session.get('current_account', 'development')
        self.session = self._create_session()
        self.client = self.session.client('secretsmanager')

    def _create_session(self):
        """Create AWS session based on environment"""
        account_config = current_app.config['AWS_ACCOUNTS'].get(self.account_id)
        if not account_config:
            raise ValueError(f"Unknown AWS account: {self.account_id}")

        return boto3.Session(
            aws_access_key_id=account_config['aws_access_key_id'],
            aws_secret_access_key=account_config['aws_secret_access_key'],
            region_name=account_config['aws_region']
        )

    def create_secret(self, name, secret_value, description=None):
        """Create a new secret in AWS Secrets Manager"""
        try:
            # Convert dict to JSON string if necessary
            if isinstance(secret_value, dict):
                secret_string = json.dumps(secret_value)
            else:
                secret_string = str(secret_value)

            # Prepare create request
            create_args = {
                'Name': name,
                'SecretString': secret_string
            }

            if description:
                create_args['Description'] = description

            # Create the secret
            response = self.client.create_secret(**create_args)
            return True
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code == 'ResourceExistsException':
                raise Exception(f"Secret '{name}' already exists")
            current_app.logger.error(f"Failed to create secret: {str(e)}")
            raise Exception(f"Failed to create secret: {str(e)}")

    def get_secret(self, secret_name):
        """Retrieve a secret from AWS Secrets Manager"""
        try:
            response = self.client.get_secret_value(SecretId=secret_name)
            if 'SecretString' in response:
                try:
                    return json.loads(response['SecretString'])
                except json.JSONDecodeError:
                    # If not JSON, return as plain text
                    return {"value": response['SecretString']}
            elif 'SecretBinary' in response:
                # Handle binary secrets if needed
                return {"value": response['SecretBinary']}
            return None
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'ResourceNotFoundException':
                return None
            current_app.logger.error(f"Failed to retrieve secret: {str(e)}")
            raise Exception(f"Failed to retrieve secret: {str(e)}")

    def list_secrets(self):
        """List all secrets in AWS Secrets Manager"""
        try:
            secrets = []
            paginator = self.client.get_paginator('list_secrets')

            for page in paginator.paginate():
                for secret in page['SecretList']:
                    secrets.append({
                        'name': secret['Name'],
                        'arn': secret['ARN'],
                        'description': secret.get('Description', ''),
                        'last_changed': secret.get('LastChangedDate', ''),
                        'tags': secret.get('Tags', [])
                    })
            return secrets
        except ClientError as e:
            current_app.logger.error(f"Error listing secrets: {str(e)}")
            raise Exception(f"Failed to list secrets: {str(e)}")

    def update_secret(self, secret_name, secret_value):
        """Update a secret in AWS Secrets Manager"""
        try:
            if isinstance(secret_value, dict):
                secret_string = json.dumps(secret_value)
            else:
                secret_string = str(secret_value)

            self.client.update_secret(
                SecretId=secret_name,
                SecretString=secret_string
            )
            return True
        except ClientError as e:
            current_app.logger.error(f"Failed to update secret: {str(e)}")
            raise Exception(f"Failed to update secret: {str(e)}")