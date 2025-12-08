# Development Scripts Helper

# Backend setup
backend-install:
	cd server && yarn install

backend-dev:
	cd server && yarn start:dev

backend-build:
	cd server && yarn build

backend-prod:
	cd server && yarn start:prod

# Frontend setup
client-install:
	cd client && yarn install

client-dev:
	cd client && yarn dev

client-build:
	cd client && yarn build

# Full setup
install-all:
	cd server && yarn install && cd ../client && yarn install

# Development (run both)
dev:
	make -j2 backend-dev client-dev

# Build all
build-all:
	cd server && yarn build && cd ../client && yarn build

# Clean
clean:
	cd server && rm -rf node_modules dist && cd ../client && rm -rf node_modules dist

# Reinstall all
reinstall:
	make clean && make install-all
