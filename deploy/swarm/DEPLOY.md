# mongodb.help, Swarm Deploy

# Update repo on server (preferred)
ssh user@server "cd /opt/mongodbhelp && git pull"

# Or copy individual files manually
scp deploy/swarm/docker-compose.swarm.yml user@server:/opt/mongodbhelp/deploy/swarm/
scp deploy/swarm/nginx/nginx.conf      user@server:/opt/mongodbhelp/deploy/swarm/nginx/

# Create .env on server (once)
ssh user@server "cp /opt/mongodbhelp/deploy/swarm/.env.example /opt/mongodbhelp/deploy/swarm/.env && vim /opt/mongodbhelp/deploy/swarm/.env"

# Deploy
ssh user@server "cd /opt/mongodbhelp/deploy/swarm && source .env && IMAGE_TAG=latest docker stack deploy -c docker-compose.swarm.yml mongodbhelp"
