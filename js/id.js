id = (function() {

function getUserFromCookie() {
    var user,
        cookieData = getCookie('GU_U'),
        userData = cookieData ? JSON.parse(decodeBase64(cookieData.split('.')[0])) : null;

    if (userData) {
        user = {
            id: userData[0],
            primaryEmailAddress: userData[1],
            displayName: userData[2],
            rawResponse: cookieData
        };
    }

    return user;
}

function decodeBase64(str) {
    return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/').replace(/,/g, '='))));
}

function getCookie(name) {
    var value = '; ' + document.cookie,
        parts = value.split('; ' + name + '=');
    if (parts.length == 2) return parts.pop().split(';').shift();
}

return {
    getUserFromCookie: getUserFromCookie
};

})();