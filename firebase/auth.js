const ADMINS = [
    "dangprograming@gmail.com",
    "cellinhang@gmail.com"
];

auth.onAuthStateChanged(user => {

    if (!user) {
        window.location.href = "../index.html";
        return;
    }

    if (!ADMINS.includes(user.email)) {
        alert("Bạn không có quyền Admin.");
        auth.signOut();
        return;
    }

});
