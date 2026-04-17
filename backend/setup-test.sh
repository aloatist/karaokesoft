#!/bin/bash
# Quick setup for testing backend API

set -e

echo "🚀 Setting up KaraokeYT Backend for testing..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy SQLite schema for easy testing
echo ""
echo "🗄️ Setting up SQLite database..."
cp prisma/schema.sqlite.prisma prisma/schema.prisma

# Create .env file if not exists
if [ ! -f .env ]; then
    echo ""
    echo "⚙️ Creating .env file..."
    cat > .env << 'EOF'
# Database (SQLite for testing)
DATABASE_URL="file:./dev.db"

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8787
FRONTEND_URL=http://localhost:5173

# JWT Secrets (change for production!)
JWT_ACCESS_SECRET=your_dev_access_secret
JWT_REFRESH_SECRET=your_dev_refresh_secret

# Stripe (optional for testing)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PREMIUM_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
EOF
    echo "✓ .env file created"
else
    echo "✓ .env file already exists"
fi

# Generate Prisma client
echo ""
echo "🔄 Generating Prisma client..."
npx prisma generate

# Run migrations
echo ""
echo "🗃️ Running database migrations..."
npx prisma migrate dev --name init --skip-generate

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Start the server:"
echo "   npm run dev"
echo ""
echo "2. In another terminal, run tests:"
echo "   ./test-api.sh"
echo ""
echo "3. Or test manually with curl:"
echo "   curl http://localhost:3001/health"
echo ""
echo "📚 See API_TESTING_GUIDE.md for detailed instructions"
