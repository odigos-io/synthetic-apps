import signal
import sys
from datetime import datetime
from flask import Flask, jsonify

# Create Flask app instance
app = Flask(__name__)

@app.route('/static/success')
def static_success():
    """Static success endpoint that returns Hello, World!"""
    print("got request for static/success, replying hello-world")
    return "Hello, World!"

@app.route('/health')
def health_check():
    """Health check endpoint"""
    print("health check requested")
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat()
    })

@app.route('/')
def root():
    """Root endpoint"""
    return jsonify({"message": "Python HTTP Server is running"})

def signal_handler(signum, frame):
    """Handle SIGTERM for graceful shutdown"""
    print("SIGTERM received, shutting down gracefully...")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handler for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the server
    print("Server running at http://127.0.0.1:8080/")
    app.run(
        host="0.0.0.0",
        port=8080,
        debug=False
    ) 