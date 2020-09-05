var crypt = require('crypto');

var _env = process.env;

var s3_bucket = _env.S3_BUCKET;
var s3_endpoint = _env.S3_ENDPOINT ? _env.S3_ENDPOINT : 's3.amazonaws.com';
var s3_access_key = _env.S3_ACCESS_KEY;
var s3_secret_key = _env.S3_SECRET_KEY;

var env_bool = new RegExp(/[Tt]rue|[Yy]es|[Oo]n|[TtYy]|1/);
var s3_ssl = env_bool.test(_env.S3_SSL_DISABLE);
var debug_on = env_bool.test(_env.DEBUG);

var s3_date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');

function debug() {
    return debug_on
}

function date_now() {
    return s3_date
}

function s3_url() {
    return `${s3_ssl ? 'http' : 'https'}://${s3_bucket}.${s3_endpoint}`
}

function s3_sign(r) {
    var s2s = r.method + '\n\n\n\n';
    s2s += `x-amz-date:${date_now()}\n`;
    s2s += '/' + s3_bucket;
    s2s += r.uri.endsWith('/') ? '/' : r.variables.s3_path;

    return `AWS ${s3_access_key}:${crypt.createHmac('sha1', s3_secret_key).update(s2s).digest('base64')}`;
}

function request(r) {
    var v = r.variables;

    function call_back(resp) {
        var body = resp.responseBody;
        if (r.method !== 'PUT' && resp.status < 400 && v.postfix === '') {
            r.headersOut['Content-Type'] = "text/html; charset=utf-8";
            body = toHTML(body);
        }

        r.return(resp.status, body);
    }

    var _subrequest_uri = r.uri;
    if (r.uri === '/') {
        // root
        _subrequest_uri = '/?delimiter=/';
    } else if (v.prefix !== '' && v.postfix === '') {
        // folder
        var slash = v.prefix.endsWith('/') ? '' : '/';
        _subrequest_uri = '/?prefix=' + v.prefix + slash;
    }

    r.subrequest(`/s3-query${_subrequest_uri}`, { method: r.method }, call_back);
}

function toHTML(xml_str) {
    var keysMap = {
        'CommonPrefixes': 'Prefix',
        'Contents': 'Key',
    };
    var pattern = `<k>(?<v>.*?)<\/k>`;

    var out = [];
    for(var group_key in keysMap) {
        var reS;
        var reGroup = new RegExp(pattern.replace(/k/g, group_key), 'g');

        while(reS = reGroup.exec(xml_str)) {
            var data = new RegExp(pattern.replace(/k/g, keysMap[group_key]), 'g');
            var reValue = data.exec(reS);

            var a_text = '';
            if (group_key === 'CommonPrefixes') {
                a_text = reValue.groups.v.replace(/\//g, '');
            } else {
                a_text = reValue.groups.v.split('/').slice(-1);
            }

            out.push(`<a href="/${reValue.groups.v}">${a_text}</a>`);
        }
    }

    return '<html><body>\n' + out.join('</br>\n') + '\n</html></body>'
}

export default {request, s3_sign, date_now, s3_url, debug}
