function healthz(r) {
    r.return(200, JSON.stringify({'active': true}));
}

export default {healthz}
