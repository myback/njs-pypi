# njs-pypi
Python Package Repository based on Nginx, [NginScript](https://github.com/nginx/njs) and S3 storage.
For signing S3 auth header uses only AWS Signature v4.

Providing minimal [PEP503](https://www.python.org/dev/peps/pep-0503/) support.
## Quick Start
### Docker
- For use AWS S3
```sh
docker run -d -p 8080:8080 -e S3_BUCKET=your_backet_name -e S3_ACCESS_KEY=your_aws_access_key -e S3_SECRET_KEY=your_aws_secret_key -e DISABLE_AUTH=true mybackspace/njs-pypi:v2
```
- For use other S3 cloud provider
```sh
docker run -d -p 8080:8080 -e S3_BUCKET=your_backet_name -e S3_ACCESS_KEY=your_provider_access_key -e S3_SECRET_KEY=your_provider_secret_key -e S3_ENDPOINT=s3.provider.com -e DISABLE_AUTH=true mybackspace/njs-pypi:v2
```
### Docker-compose
```sh
git clone https://github.com/myback/njs-pypi.git
cd njs-pypi
vi nginx/nginx.conf
```
```nginx
...

    server {
        listen                      8080;

        # resolver          8.8.8.8   valid=300s;
        resolver                    127.0.0.11;  # docker
        resolver_timeout            3s;

...
```
```sh
docker-compose up -d
```
### Kubernetes
```sh
git clone https://github.com/myback/njs-pypi.git
cd njs-pypi

# Edit values
vi helm/njs-pypi/values.yaml

# And install
helm install helm/njs-pypi --name=njs-pypi
```
## Usage
### PIP
#### Command line
```sh
pip install pkg_name --extra-index-url localhost:8080

# If use authentication
pip install pkg_name --extra-index-url http://login:password@localhost:8080
```
#### pip.conf
```ini
[global]
timeout = 60
extra-index-url = http://login:password@localhost:8080
```
### Gitlab pipeline
#### Upload
```yaml
pkg:upload:
  image: python:3.8-alpine3.10
  script:
    - apk add --no-cache curl
    - pip install setuptools wheel
    - python setup.py sdist bdist_wheel
    - curl -sSfT "{$(echo dist/* | tr ' ' ',')}" -u "gitlab-ci-token:${CI_JOB_TOKEN}" "https://url2pypi/${CI_PROJECT_NAME}/"
```
#### pip install
```yaml
requirements:install:
  image: python:3.8-alpine3.10
  script:
    - pip install -r requirements.txt --extra-index-url https://gitlab-ci-token:${CI_JOB_TOKEN}@url2pypi
```
### curl
```sh
# List all packages
curl http://localhost:8080/

# List package versions
curl http://localhost:8080/pkg_name

# If use authentication
curl -u 'login:password' http://localhost:8080/

# For upload new package or update existing
curl -u 'login:password' -T /path/to/pkg_name-1.0.0.tgz http://localhost:8080/pkg_name/

# Update package in nginx cache
curl -H 'update-pkg: true' http://localhost:8080/pkg_name/pkg_name-1.0.0.tgz
```

## Environment variables settings
```
DEBUG - Enable Nginx debug log. Default: false

AUTH_URL - Full url to authentication service. Required if DISABLE_AUTH=false

DISABLE_AUTH - Disable authentication. Default: false

S3_SSL_DISABLE - Use http:// to connect to the S3. Default: false

S3_BUCKET - Bucket name. Required.

S3_ENDPOINT - Set if not AWS S3 service used (set without http(s)://). Default s3.amazonaws.com.

S3_ACCESS_KEY - Required.

S3_SECRET_KEY - Required.
```
