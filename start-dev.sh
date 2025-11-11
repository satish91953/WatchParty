#!/bin/bash

echo "🎬 Starting Watch Party Pro Development Environment"
echo "=================================================="

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   sudo systemctl start mongod"
    echo "   OR"
    echo "   mongod"
    echo ""
fi

# Function to start server
start_server() {
    echo "🚀 Starting backend server..."
    cd server
    npm run dev &
    SERVER_PID=$!
    cd ..
    echo "Backend server started (PID: $SERVER_PID)"
}

# Function to start client
start_client() {
    echo "🎨 Starting frontend client..."
    cd client
    npm start &
    CLIENT_PID=$!
    cd ..
    echo "Frontend client started (PID: $CLIENT_PID)"
}

# Start both services
start_server
sleep 3
start_client

echo ""
echo "✅ Development environment started!"
echo "📱 Frontend: http://localhost:3000"
echo "🖥️  Backend: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'echo "Stopping services..."; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit' INT
wait
