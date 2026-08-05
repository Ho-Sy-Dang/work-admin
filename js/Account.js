// Lấy element của nút đăng xuất
const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        // Gọi hàm đăng xuất của Firebase
        auth.signOut()
            .then(() => {
                // index.html nằm ngoài thư mục 'pages' (ở gốc Admin), nên cần lùi ra 1 cấp
                window.location.href = "../index.html"; 
            })
            .catch((error) => {
                console.error("Lỗi đăng xuất: ", error);
                alert("Có lỗi xảy ra khi đăng xuất: " + error.message);
            });
    });
}
