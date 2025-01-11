import sys
print(f"Python path: {sys.path}")

try:
    from app import create_app
    print("Successfully imported create_app")
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Current directory: {sys.path[0]}")
    sys.exit(1)

app = create_app()

if __name__ == '__main__':
    port = app.config.get('SERVER_PORT', 5001)
    print(f"Starting server on port: {port}")
    app.run(
        host='localhost',
        port=port,
        debug=True
    )