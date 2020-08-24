var env = process.env;
var env_bool = new RegExp(/[Tt]rue|[Yy]es|[Oo]n|[TtYy]|1/);
var auth_disabled  = env_bool.test(env.DISABLE_AUTH);
var gitlab_url = env.AUTH_URL;

function url() {
    return gitlab_url
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
