const form = document.querySelector("form");
const username = document.querySelector("input[type='text']");
const password = document.querySelector("input[type='password']");

form.addEventListener("submit", async function (e) {

    e.preventDefault();

    const email = username.value.trim();
    const pass = password.value.trim();

    if (email === "" || pass === "") {
        alert("Please enter email and password.");
        return;
    }

    try {

        await auth.signInWithEmailAndPassword(email, pass);

        window.location.href = "pages/Home.html";

    }

    catch (error) {

        switch (error.code) {

            case "auth/invalid-email":
                alert("Email không hợp lệ.");
                break;

            case "auth/user-not-found":
                alert("Không tìm thấy tài khoản.");
                break;

            case "auth/wrong-password":
                alert("Sai mật khẩu.");
                break;

            default:
                alert(error.message);

        }

    }

});