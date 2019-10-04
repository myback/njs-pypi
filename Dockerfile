FROM nginx:alpine

COPY nginx/ /etc/nginx/

EXPOSE 8080/tcp
USER nginx
