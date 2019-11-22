var crypt = require('crypto'),
    s3_bucket = process.env.S3_BUCKET,
    auth_disabled = /[Tt]rue/.test(process.env.DISABLE_AUTH),
    s3_date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');

function gitlab_url() {
    return process.env.GITLAB_URL
}

function debug() {
    return process.env.DEBUG_LOG
}

function date_now() {
    return s3_date
}

function s3_endpoint() {
    var proto = /[Tt]rue/.test(process.env.S3_SSL_DISABLE) ? proto = 'http://' : proto = 'https://',
        host = process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT : 's3.amazonaws.com';

    return proto + host
}

Object.prototype.toHTML = function() {
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
    if (xml === undefined) { xml = this };
    var regexResult,
        out = {},
        reS = /^[^<]+/,
        reO = /<(?<key>[\w\-\.\:]+)\s*(?<tags>[^>]*)>(?<body>.*?)<\/\1>/g,
        regexObject = new RegExp(reO),
        regexString = new RegExp(reS);

    while(regexResult = regexObject.exec(xml)) {
        var bodyKey = regexResult.groups.key,
            bodyValue = regexResult.groups.body;
            //tags = '',
            //bodyTags = regexResult.groups.tags,

        //if (bodyTags != '') {
        //    tags = {};
        //    bodyTags.split(/\s/).forEach(function(e){
        //        var kv = e.split('=');

        //        if (kv.length == 2) {
        //            tags[kv[0]] = kv[1].replace(/["']/g, '');
        //        }
        //    });
        //}

        if (bodyValue === '') {
            out[bodyKey] = '';

        // string check
        } else if (regexString.test(bodyValue)) {
            var value = regexString.exec(bodyValue);
            //out[bodyKey] = {
            //    'tags': tags,
            //    'value': value[0].replace(/\"/g, ''),
            //};
            out[bodyKey] = value[0].replace(/\"/g, '');

        // object check
        } else if (regexObject.test(bodyValue)) {
            //var newObj = {
            //  'tags': tags,
            //  'value': xml_parse(bodyValue),
            //};
            var newObj = xml_parse(bodyValue);

            if (bodyKey in out) {
              if (out[bodyKey] instanceof Array) {
                  out[bodyKey].push(newObj);

              } else if (out[bodyKey] instanceof Object) {
                  out[bodyKey] = [out[bodyKey], newObj];

              } else {
                  return null
              }

            } else {
                out[bodyKey] = newObj
            }

        } else {
            return null
        }
    }
     return out
}

function s3_sign_header(r) {
    var _headers = r.headersIn,
        string_to_sign = r.method + '\n\n\n\n';

    if (r.method == 'PUT' && _headers['x-amz-acl']) {
        string_to_sign += `x-amz-acl:${_headers['x-amz-acl']}\n`;
    }

    string_to_sign += `x-amz-date:${date_now()}\n`;
    string_to_sign += r.uri.endsWith('/') ? '/' + s3_bucket + '/' : r.variables.s3_uri;

    return `AWS ${process.env.S3_ACCESS_KEY}:${crypt.createHmac('sha1', process.env.S3_SECRET_KEY).update(string_to_sign).digest('base64')}`;
}

function parseBasicAuthorization(auth_header) {
    if (auth_header != "") {
        var token = auth_header.split(" ");

        if (token[0] == "Basic" && token.length == 2) {
            var cred = String.bytesFrom(token[1], 'base64');

            return {
                    user: cred.substr(0, cred.indexOf(':')),
                    password: cred.substr(cred.indexOf(':') + 1)
                }
        }
    }
}

function gitlab_auth(r) {
    if (auth_disabled) {
        r.return(202, '{"auth": "disabled"}');
        return
    }

    if (r.headersIn['Authorization']) {
        var cred = parseBasicAuthorization(r.headersIn['Authorization']);

        r.subrequest('/gitlab',
            {method: 'POST', body: `grant_type=password&username=${cred.user}&password=${cred.password}`},
            function(res) {
                r.return(res.status, res.responseBody);
            }
        );

    } else {
        r.return(401, "");
        return
    }
}

function s3_request(r) {
    var s3_sub_uri;

    function sub(res) {
        var  body = res.responseBody;

        if (r.method == 'PUT' || res.status >= 300) {
            r.headersOut['Content-Type'] = "application/xml; charset=utf-8";
            r.return(res.status, body);

        } else {
            if (r.variables.s3_uri.endsWith('/')) {
                r.headersOut['Content-Type'] = "text/html; charset=utf-8";
                r.return(
                    res.status, 
                    body
                    .replace(/\<[^>]*[\s]*\/>/g, '')
                    .replace(/>\s+</g, '><')
                    .XMLParser()
                    .toHTML());

            } else {
                r.return(res.status, body);
            }
        }
    }

    if (/^\/\w+[\/]{0,1}$/.test(r.uri)) {
        var slash = r.uri.endsWith('/') ? '' : '/';
        s3_sub_uri = '/?prefix=' + r.variables.prefix + slash;

    } else if (/^\/\w+\/.+/.test(r.uri) || /^\/[\w\.\-]+$/.test(r.uri) || r.method == 'PUT') {
        s3_sub_uri = r.uri;

    } else {
        s3_sub_uri = '/?delimiter=/';
    }

    r.subrequest(`/bucket-query/${s3_bucket}${s3_sub_uri}`, { method: r.method }, sub)
}
