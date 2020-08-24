var crypt = require('crypto');
// const start
// https://github.com/nginx/njs/issues/105
var _algorithm = 'AWS4-HMAC-SHA256';
var _payload = 'UNSIGNED-PAYLOAD';
var _region = 'us-east-1';
var _service = 's3';
var _type_req = 'aws4_request';
var _user_agent = 'njs-pypi/2.0.0';
// const end

// environment variables start
var env = process.env;
var env_bool = new RegExp(/[Tt]rue|[Yy]es|[Oo]n|[TtYy]|1/);

var s3_access_key = env.S3_ACCESS_KEY;
var s3_secret_key = env.S3_SECRET_KEY;
var s3_bucket = env.S3_BUCKET;
var s3_endpoint = env.S3_ENDPOINT ? env.S3_ENDPOINT : 's3.amazonaws.com';
var s3_ssl_disable = env_bool.test(env.S3_SSL_DISABLE);
var debug_on = env_bool.test(env.DEBUG);
// environment variables end

var date_now = new Date();
var URL = _parse_url(s3_endpoint);
var canonical_querystring = 'delimiter=%2F&list-type=2&max-keys=1000&prefix=';
// var host = `${s3_bucket}.${url.host}`;

function _parse_url(raw_url) {
    var _url = {};
    var default_schema = s3_ssl_disable ? 'http' : 'https';
    var parsed_url = /^((?<schema>http[s]?):\/\/){0,1}(?<host>[^\/]*)(?<path>[^?\n]*)\?{0,1}(?<query>.*)/g.exec(raw_url);

    if (parsed_url.groups.schema === undefined || parsed_url.groups.schema === '') {
        _url['schema'] = default_schema;
    }

    _url['host'] = parsed_url.groups.host;

    var host_port = parsed_url.groups.host.split(':');
    if (host_port.length == 2) {
        if (host_port[1] == 80 || host_port[1] == 443) {
            _url.host = host_port[0]
        }
    }

    _url['path'] = parsed_url.groups.path;
    _url['raw_query'] = parsed_url.groups.query;

    return _url
}

function _s3_host() {
    return `${s3_bucket}.${URL.host}`
}

function _sign(key, msg) {
    return crypt.createHmac('sha256', key).update(msg).digest()
}

function _getSignatureKey(key, dateStamp, regionName, serviceName) {
    var kDate = _sign('AWS4' + key, dateStamp);
    var kRegion = _sign(kDate, regionName);
    var kService = _sign(kRegion, serviceName);

    return _sign(kService, _type_req)
}

function dt() {
    return date_now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
}

function ds() {
    return date_now.toISOString().split('T')[0].replace(/-/g, '')
}

function ua() {
    return _user_agent
}

function pl() {
    return _payload
}

function s3Url() {
    return `${URL.schema}://${_s3_host()}`
}

function debug() {
    return debug_on
}

function awsSignature(r) {
    var signed_headers = 'host;user-agent;x-amz-content-sha256;x-amz-date';
    var canonical_request = `${r.method}\n`;

    if (!r.variables.s3_path.startsWith('?')) {
        canonical_request += `/${r.variables.s3_path}\n`;
        canonical_request += '\n';
    } else {
        canonical_request += `/\n`;
        canonical_request += `${r.variables.s3_path.replace(/\?/, '')}\n`;
    }

    canonical_request += `host:${_s3_host()}\nuser-agent:${_user_agent}\nx-amz-content-sha256:${_payload}\nx-amz-date:${dt()}\n\n${signed_headers}\n${_payload}`;

    var credential_scope = `${ds()}/${_region}/${_service}/${_type_req}`;
    var string_to_sign = `${_algorithm}\n`;
    string_to_sign += `${dt()}\n`;
    string_to_sign += `${credential_scope}\n`;
    string_to_sign += crypt.createHash('sha256').update(canonical_request).digest('hex');

    var signing_key = _getSignatureKey(s3_secret_key, ds(), _region, _service);
    var signature = crypt.createHmac('sha256', signing_key).update(string_to_sign).digest('hex');

    return `${_algorithm} Credential=${s3_access_key}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`
}

function request(r) {
    var v = r.variables;

    if (r.method !== 'GET' && r.method !== 'PUT') {
        r.return(405, "405: Method not allowed");
        return null
    }

    function call_back(res) {
        var body = res.responseBody;

        if (r.method === 'PUT' || res.status >= 300) {
            r.headersOut['Content-Type'] = "application/xml; charset=utf-8";
            r.return(res.status, body);

        } else {
            if (v.s3_path.endsWith('%2F') || v.s3_path.endsWith('=')) {
                r.headersOut['Content-Type'] = "text/html; charset=utf-8";

                r.return(
                    res.status,
                    body
                    .replace(/\<[^>]*[\s]*\/>/g, '')
                    .replace(/>\s+</g, '><')
                    .XMLParser()
                    .toHTML()
                );

            } else {
                r.return(res.status, body);
            }
        }
    }

    var _subrequest_uri = '';
    if (r.uri === '/') {
        // root
        _subrequest_uri = `/?${canonical_querystring}`;
    } else if (v.prefix !== '' && v.postfix === '') {
        // folder
        _subrequest_uri = `/?${canonical_querystring}${v.prefix}%2F`;
    } else {
        // file
        _subrequest_uri = r.uri;
    }

    r.subrequest(`/s3-query${_subrequest_uri}`, { method: r.method }, call_back)
}

Object.prototype.toHTML = function(r) {
    var out = [],
        xmlData = this.ListBucketResult;
    //xmlData = this.ListBucketResult.value;

    if ('CommonPrefixes' in xmlData) {
        if (xmlData.CommonPrefixes instanceof Array) {
            xmlData.CommonPrefixes.forEach(function(e){
                //out.push(`<a href="/${e.value.Prefix.value}">${e.value.Prefix.value.replace(/\//g, '')}</a>`);
                out.push(`<a href="/${e.Prefix}">${e.Prefix.replace(/\//g, '')}</a>`);});

        } else {
            //out.push(`<a href="/${xmlData.CommonPrefixes.value.Prefix.value}">${xmlData.CommonPrefixes.value.Prefix.value.replace(/\//g, '')}</a>`);
            out.push(`<a href="/${xmlData.CommonPrefixes.Prefix}">${xmlData.CommonPrefixes.Prefix.replace(/\//g, '')}</a>`);
        }
    }

    if ('Contents' in xmlData) {
        var cont = xmlData.Contents;

        if (cont instanceof Array) {
            cont.forEach(function(e){
                if (!e.Key.endsWith('/')) {
                    //out.push(`<a href="/${e.value.Key}">${e.value.Key.split('/').slice(-1)}</a>`);
                    out.push(`<a href="/${e.Key}">${e.Key.split('/').slice(-1)}</a>`);
                }});

        } else {
            out.push(`<a href="/${cont.Key}">${cont.Key.split('/').slice(-1)}</a>`);
        }
    }

    return '<html><body>\n' + out.join('</br>\n') + '\n</html></body>'
}

String.prototype.XMLParser = function xml_parse(xml) {
    if (xml === undefined) { xml = this }
    var reResult,
        out = {},
        reObj = /<(?<key>[\w\-\.\:]+)\s*(?<tags>[^>]*)>(?<value>.*?)<\/\1>/g,
        reObject = new RegExp(reObj),
        reString = new RegExp(/^[^<]+/);

    while(reResult = reObject.exec(xml)) {
        var v,
            reObjTest = new RegExp(reObj),
            bodyKey = reResult.groups.key,
            bodyValue = reResult.groups.value;

        if (reObjTest.test(bodyValue)) {
            v = xml_parse(bodyValue);
        } else if (reString.test(bodyValue)) {
            v = bodyValue.replace(/\"/g, '').replace(/&quot;/g, '');
        } else {
            v = bodyValue;
        }

        if (bodyKey in out) {
            if (out[bodyKey] instanceof Array) {
                out[bodyKey].push(v);
            } else {
                out[bodyKey] = [out[bodyKey], v];
            }

        } else {
            out[bodyKey] = v
        }
    }
    return out
}

export default {awsSignature, s3Url, request, dt, pl, ua, debug}
