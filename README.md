# Nginx-S3PyPi
Python Package Repository based on Nginx with [NginScript](https://github.com/nginx/njs) with storage backend in S3 bucket.

Providing minimal [PEP503](https://www.python.org/dev/peps/pep-0503/) support.
# Quick Start
## Docker
- For use AWS S3
```sh
docker run -d -p 8080:8080 -e S3_BUCKET=your_backet_name -e S3_ACCESS_KEY=your_aws_access_key -e S3_SECRET_KEY=your_aws_secret_key -e DISABLE_AUTH=true mybackspace/nginx-s3pypi
```
- For use other S3 cloud provider
```sh
docker run -d -p 8080:8080 -e S3_BUCKET=your_backet_name -e S3_ACCESS_KEY=your_provider_access_key -e S3_SECRET_KEY=your_provider_secret_key -e S3_ENDPOINT=s3.example.com -e DISABLE_AUTH=true mybackspace/nginx-s3pypi
```
## Docker-compose
```sh
git clone https://github.com/myback/nginx-s3pypi.git
cd nginx-s3pypi
docker-compose up -d
```
## Kubernetes
```sh
git clone https://github.com/myback/nginx-s3pypi.git
cd nginx-s3pypi

# Edit values
vi helm/nginx-s3pypi/values.yaml

# And install
helm install helm/nginx-s3pypi --name=nginx-s3pypi
```
# Usage
## PIP
### Command line
```sh
pip install pkg_name -i localhost:8080

# If use authentication
pip install pkg_name -i http://login:password@localhost:8080
```
### pip.conf
```ini
[global]
timeout = 60
index-url = http://login:password@localhost:8080
```
### Gitlab pipeline
```yaml
pkg:upload:
  image: byrnedo/alpine-curl
  variables:
    PKG_NAME: ${CI_PROJECT_NAME}
  script:
    - curl -u "gitlab-ci-token:${CI_JOB_TOKEN}" -T "/path/to/${PKG_NAME}" "https://url2pypi/${PKG_NAME}/${PKG_NAME}-${CI_COMMIT_TAG}.tgz"
```
### curl
```sh
# List all packages
curl http://localhost:8080/
# If use authentication
curl -u 'login:password' http://localhost:8080/

# For upload new package or update existing
curl -u 'login:password' -T /path/to/pkg_name http://localhost:8080/pkg_name/pkg_name-1.0.0.tgz
```

# Environment variables settings
```
DEBUG_LOG - Enable Nginx debug log. Default: false

GITLAB_URL - Full url to Gitlab. Required if DISABLE_AUTH=false

DISABLE_AUTH - Disable authentication. Default: false

S3_SSL_DISABLE - Use http:// to connect to the S3. Default: false

S3_BUCKET - Bucket name. Required.

S3_ENDPOINT - If not AWS used (set without http(s)://). Default AWS S3 used.

S3_ACCESS_KEY - Required.

S3_SECRET_KEY - Required.
```

# Use authentication for upload only
**nginx.conf**
```
...

location ~ "^/(?<prefix>[\w]*[/]{0,1})(?<postfix>[\w\-\.]*)" {
    if ($request_method = 'PUT') {
        auth_request /auth;
    }

    js_content   s3_request;
}

...
```
