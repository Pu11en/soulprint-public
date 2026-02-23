FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash soulprint

# Install clawdbot and AWS SDK
RUN npm install -g clawdbot@latest @aws-sdk/client-bedrock-runtime

RUN mkdir -p /home/soulprint/workspace && chown -R soulprint:soulprint /home/soulprint

WORKDIR /home/soulprint/workspace

COPY --chown=soulprint:soulprint start.sh /home/soulprint/start.sh
RUN chmod +x /home/soulprint/start.sh

USER soulprint

EXPOSE 8080

CMD ["/home/soulprint/start.sh"]
