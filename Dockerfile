FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine

COPY --chown=nginx:nginx src/ /usr/share/nginx/html/

EXPOSE 8080
