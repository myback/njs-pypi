var env = process.env;
var env_bool = new RegExp(/[Tt]rue|[Yy]es|[Oo]n|[TtYy]|1/);
var auth_disabled  = env_bool.test(env.DISABLE_AUTH);
var gitlab_url = env.AUTH_URL;

function parse_url(raw_url) {
    var _url = {};
    var parsed_url = /^((?<schema>http[s]?):\/\/){0,1}(?<host>[^\/]*)(?<path>[^?\n]*)\?{0,1}(?<query>.*)/g.exec(raw_url);

    if (parsed_url.groups.schema === undefined || parsed_url.groups.schema === '') {
        _url['schema'] = 'http';
    } else {
        _url['schema'] = parsed_url.groups.schema;
    }

    _url['host'] = parsed_url.groups.host;
    _url['path'] = parsed_url.groups.path;
    _url['raw_query'] = parsed_url.groups.query;

    var host_port = parsed_url.groups.host.split(':');
    if (host_port.length == 2) {
        if ((_url['schema'] === 'http' && host_port[1] == 80) || (_url['schema'] = 'https' && host_port[1] == 443)) {
            _url.host = host_port[0]
        }
    }

    return _url
}

function url() {
    var u = parse_url(gitlab_url)
    return `${u.schema}://${u.host}/jwt/auth?service=container_registry`
}

function auth(r) {
    if (auth_disabled) {
        r.return(202, '{"auth": "disabled"}');
        return null
    }

    r.subrequest('/auth-provider',
        {method: 'GET', body: ''},
        function(res) {
            r.return(res.status, "");
        }
    );
}

export default {auth, url}
