import os
from dotenv import load_dotenv
from app import create_app
from app.config.settings import Config

# Load environment variables from the correct directory
env_file = os.getenv('ENV_FILE', '.env')
load_dotenv(env_file)

# Initialize config after environment variables are loaded
Config.init_config()

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)