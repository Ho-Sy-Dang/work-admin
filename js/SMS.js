/*====================================================
    SMS.JS
    Quản lý Classes (lớp học) và Students (học sinh)
    Giao diện dùng chung style item-card / modal của
    History.html & Home.css để đồng bộ với các trang khác.
====================================================*/

if (typeof firebase === "undefined") {
    alert("Firebase chưa được tải!");
    throw new Error("Firebase Missing");
}

if (typeof db === "undefined") {
    alert("Firestore chưa khởi tạo!");
    throw new Error("Firestore Missing");
}

//=========================
// State
//=========================

let allStudents = [];
let allClasses = [];

let pickMode = null;          // "create" | "edit"
let editingClassId = null;    // lớp đang tạo/sửa danh sách học sinh
let currentViewClassId = null; // lớp đang xem chi tiết
let newClassName = "";
let selectedStudentIds = new Set();

let pendingNameChanges = {}; // { studentId: {reqId, oldName, newName} }

//=========================
// DOM
//=========================

const tabClasses = document.getElementById("tab-classes");
const tabStudents = document.getElementById("tab-students");
const sectionClasses = document.getElementById("section-classes");
const sectionStudents = document.getElementById("section-students");

const classesContainer = document.getElementById("classes-container");
const classesEmpty = document.getElementById("classes-empty");
const btnAddClass = document.getElementById("btn-add-class");
let inputClassesSearch; // Chuyển thành let để khởi tạo động bên dưới

const modalClassForm = document.getElementById("modal-class-form");
const stepClassName = document.getElementById("step-class-name");
const stepClassStudents = document.getElementById("step-class-students");
const inputNewClassName = document.getElementById("input-new-class-name");
const btnClassNameCancel = document.getElementById("btn-class-name-cancel");
const btnClassNameNext = document.getElementById("btn-class-name-next");

const classStudentsTitle = document.getElementById("class-students-title");
const inputClassStudentSearch = document.getElementById("input-class-student-search");
const classStudentList = document.getElementById("class-student-list");
const btnClassStudentsBack = document.getElementById("btn-class-students-back");
const btnClassStudentsSave = document.getElementById("btn-class-students-save");

const modalClassView = document.getElementById("modal-class-view");
const classViewTitle = document.getElementById("class-view-title");
const classViewStudents = document.getElementById("class-view-students");
const classViewEmpty = document.getElementById("class-view-empty");
const btnClassViewClose = document.getElementById("btn-class-view-close");
const btnClassViewEdit = document.getElementById("btn-class-view-edit");
const btnClassViewDelete = document.getElementById("btn-class-view-delete");

const studentsContainer = document.getElementById("students-container");
const studentsEmpty = document.getElementById("students-empty");
const inputStudentsSearch = document.getElementById("input-students-search");

const modalStudentDetail = document.getElementById("modal-student-detail");
const detailStudentName = document.getElementById("detail-student-name");
const detailStudentClass = document.getElementById("detail-student-class");
const detailStudentAdmin = document.getElementById("detail-student-admin");
const detailRequestsList = document.getElementById("detail-requests-list");
const detailAssignmentsList = document.getElementById("detail-assignments-list");
const detailBtnClose = document.getElementById("detail-btn-close");

const toastContainer = document.getElementById("toast-container");

//=========================
// Toast
//=========================

function showToast(text) {
    toastContainer.innerHTML = "";
    const div = document.createElement("div");
    div.className = "toast";
    div.innerHTML = text;
    toastContainer.appendChild(div);
    setTimeout(() => div.classList.add("show"), 100);
    setTimeout(() => div.classList.remove("show"), 3000);
}

//=========================
// Khởi động
//=========================

window.onload = function () {
    wireTabs();
    wireClassModals();
    wireClassesSearch(); // Khởi tạo tính năng tìm kiếm lớp học
    wireStudentsTab();
    wireStudentDetailModal();
    loadStudents();
    loadClasses();
};

//=========================
// Tabs (Classes / Students)
//=========================

function wireTabs() {
    tabClasses.addEventListener("click", () => switchTab("classes"));
    tabStudents.addEventListener("click", () => switchTab("students"));
}

function switchTab(tab) {
    if (tab === "classes") {
        tabClasses.className = "btn btn-primary";
        tabStudents.className = "btn btn-secondary";
        sectionClasses.style.display = "block";
        sectionStudents.style.display = "none";
    } else {
        tabStudents.className = "btn btn-primary";
        tabClasses.className = "btn btn-secondary";
        sectionStudents.style.display = "block";
        sectionClasses.style.display = "none";
    }
}

//=========================
// Load dữ liệu Firestore
//=========================

async function loadStudents() {
    try {
        const snap = await db.collection("students").orderBy("name").get();
        allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error(error);
        allStudents = [];
    }

    await loadPendingNameChanges();
    renderStudentsTab();
}

async function loadPendingNameChanges() {
    pendingNameChanges = {};
    try {
        const snap = await db
            .collectionGroup("nameChangeRequests")
            .where("status", "==", "pending")
            .get();

        snap.forEach(doc => {
            const studentId = doc.ref.parent.parent.id;
            pendingNameChanges[studentId] = { reqId: doc.id, ...doc.data() };
        });
    } catch (error) {
        console.error("Lỗi khi tải yêu cầu đổi tên:", error);

        if (error && (error.code === "failed-precondition" || (error.message || "").toLowerCase().includes("index"))) {
            showToast("⚠️ Firestore cần tạo Index cho 'nameChangeRequests' - mở Console (F12) để lấy link tạo Index");
        } else {
            showToast("⚠️ Lỗi khi tải yêu cầu đổi tên - mở Console (F12) để xem chi tiết");
        }
    }
}

async function loadClasses() {
    try {
        const snap = await db.collection("classes").orderBy("name").get();
        allClasses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error(error);
        allClasses = [];
    }
    renderClassesList();
    renderStudentsTab(); // để cập nhật lại danh sách lớp hiển thị của mỗi học sinh
}

function getStudentClassNames(studentId) {
    return allClasses
        .filter(c => (c.studentIds || []).includes(studentId))
        .map(c => c.name);
}

//=========================
// CLASSES SEARCH & LIST
//=========================

function wireClassesSearch() {
    // Thử tìm trong HTML xem đã có ô input nào chưa
    inputClassesSearch = document.getElementById("input-classes-search");

    // Nếu chưa có (HTML không có sẵn), JS sẽ tự động tạo và chèn vào giao diện
    if (!inputClassesSearch) {
        inputClassesSearch = document.createElement("input");
        inputClassesSearch.type = "text";
        inputClassesSearch.id = "input-classes-search";
        inputClassesSearch.placeholder = "🔍 Tìm kiếm lớp học...";
        
        // Style cơ bản cho giống thanh tìm kiếm bên tab students
        inputClassesSearch.style.width = "100%";
        inputClassesSearch.style.padding = "10px";
        inputClassesSearch.style.marginBottom = "15px";
        inputClassesSearch.style.borderRadius = "6px";
        inputClassesSearch.style.border = "1px solid #ccc";
        inputClassesSearch.style.boxSizing = "border-box";
        inputClassesSearch.style.fontSize = "16px";

        // Chèn nó vào ngay trước phần chứa danh sách lớp học
        if (classesContainer && classesContainer.parentNode) {
            classesContainer.parentNode.insertBefore(inputClassesSearch, classesContainer);
        }
    }

    // Gắn sự kiện khi nhập chữ để lọc
    inputClassesSearch.addEventListener("input", () => {
        renderClassesList(inputClassesSearch.value.trim().toLowerCase());
    });
}

function renderClassesList(filter) {
    filter = filter || "";
    classesContainer.innerHTML = "";

    const filtered = allClasses.filter(cls =>
        !filter || (cls.name || "").toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        classesEmpty.style.display = "block";
        return;
    }

    classesEmpty.style.display = "none";

    filtered.forEach(cls => {
        const count = (cls.studentIds || []).length;

        const card = document.createElement("div");
        card.className = "item-card";
        card.innerHTML = `
            <div class="card-header">
                <h2>🏫 ${escapeHtml(cls.name)}</h2>
            </div>
            <div class="card-info">
                <p>👥 ${count} học sinh</p>
            </div>
            <div class="card-buttons">
                <button class="btn-view" data-id="${cls.id}">View</button>
            </div>
        `;
        card.querySelector(".btn-view").addEventListener("click", () => openClassView(cls.id));
        classesContainer.appendChild(card);
    });
}

//=========================
// MODAL: TẠO / SỬA LỚP (2 bước trong cùng 1 modal)
//=========================

function wireClassModals() {

    btnAddClass.addEventListener("click", () => {
        pickMode = "create";
        editingClassId = null;
        inputNewClassName.value = "";
        stepClassName.style.display = "block";
        stepClassStudents.style.display = "none";
        modalClassForm.classList.add("active");
        inputNewClassName.focus();
    });

    btnClassNameCancel.addEventListener("click", () => {
        modalClassForm.classList.remove("active");
    });

    btnClassNameNext.addEventListener("click", () => {
        const name = inputNewClassName.value.trim();
        if (name === "") {
            alert("Vui lòng nhập tên lớp!");
            return;
        }
        newClassName = name;
        openPickStudentsStep("create");
    });

    inputClassStudentSearch.addEventListener("input", () => {
        renderPickList(inputClassStudentSearch.value.trim().toLowerCase());
    });

    btnClassStudentsBack.addEventListener("click", () => {
        if (pickMode === "create") {
            stepClassStudents.style.display = "none";
            stepClassName.style.display = "block";
        } else {
            modalClassForm.classList.remove("active");
            modalClassView.classList.add("active");
        }
    });

    btnClassStudentsSave.addEventListener("click", saveClassStudents);

    // Modal xem chi tiết lớp
    btnClassViewClose.addEventListener("click", () => {
        modalClassView.classList.remove("active");
    });

    btnClassViewEdit.addEventListener("click", () => {
        modalClassView.classList.remove("active");
        editingClassId = currentViewClassId;
        openPickStudentsStep("edit");
        modalClassForm.classList.add("active");
    });

    btnClassViewDelete.addEventListener("click", async () => {
        if (!currentViewClassId) return;
        const ok = confirm("Bạn có chắc muốn xóa lớp này?");
        if (!ok) return;

        try {
            await db.collection("classes").doc(currentViewClassId).delete();
            showToast("Đã xóa lớp.");
            modalClassView.classList.remove("active");
            currentViewClassId = null;
            await loadClasses();
        } catch (error) {
            console.error(error);
            alert("Có lỗi khi xóa lớp!");
        }
    });
}

function openPickStudentsStep(mode) {
    pickMode = mode;
    selectedStudentIds = new Set();

    stepClassName.style.display = "none";
    stepClassStudents.style.display = "block";

    if (mode === "create") {
        classStudentsTitle.innerText = `Thêm học sinh vào "${newClassName}"`;
        btnClassStudentsSave.innerText = "Add";
    } else {
        const cls = allClasses.find(c => c.id === editingClassId);
        classStudentsTitle.innerText = `Chỉnh sửa học sinh trong "${cls ? cls.name : ""}"`;
        btnClassStudentsSave.innerText = "Save";
        (cls && cls.studentIds ? cls.studentIds : []).forEach(id => selectedStudentIds.add(id));
    }

    inputClassStudentSearch.value = "";
    renderPickList("");
}

function renderPickList(filter) {
    classStudentList.innerHTML = "";

    const filtered = allStudents.filter(s =>
        !filter || (s.name || "").toLowerCase().includes(filter)
    );

    const countLabel = document.createElement("div");
    countLabel.className = "pick-count";
    countLabel.innerText = `Đã chọn ${selectedStudentIds.size} học sinh`;
    classStudentList.appendChild(countLabel);

    if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.style.color = "#999";
        empty.innerText = "Không tìm thấy học sinh nào";
        classStudentList.appendChild(empty);
        return;
    }

    filtered.forEach(s => {
        const checked = selectedStudentIds.has(s.id);

        const row = document.createElement("div");
        row.className = "student-pick-item" + (checked ? " checked" : "");
        row.innerHTML = `
            <input type="checkbox" ${checked ? "checked" : ""}>
            <div class="pick-info">
                <h4>${escapeHtml(s.name || "(Không tên)")}</h4>
                <p>${escapeHtml(getStudentClassNames(s.id).join(", ") || "Chưa xếp lớp")}</p>
            </div>
        `;

        row.addEventListener("click", () => {
            if (selectedStudentIds.has(s.id)) selectedStudentIds.delete(s.id);
            else selectedStudentIds.add(s.id);
            renderPickList(filter);
        });

        classStudentList.appendChild(row);
    });
}

async function saveClassStudents() {
    btnClassStudentsSave.disabled = true;
    const originalText = btnClassStudentsSave.innerText;
    btnClassStudentsSave.innerText = "Saving...";

    try {
        const studentIds = Array.from(selectedStudentIds);

        if (pickMode === "create") {

            const docRef = await db.collection("classes").add({
                name: newClassName,
                studentIds: studentIds,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await notifyStudentsAddedToClass(studentIds, [], newClassName);

            showToast("Đã tạo lớp thành công!");
            modalClassForm.classList.remove("active");
            await loadClasses();

        } else {

            const cls = allClasses.find(c => c.id === editingClassId);
            const previousIds = (cls && cls.studentIds) ? cls.studentIds : [];

            await db.collection("classes").doc(editingClassId).update({
                studentIds: studentIds,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await notifyStudentsAddedToClass(studentIds, previousIds, cls ? cls.name : "");

            showToast("Đã cập nhật danh sách học sinh!");
            modalClassForm.classList.remove("active");
            await loadClasses();
            openClassView(editingClassId);
        }

    } catch (error) {
        console.error(error);
        alert("Có lỗi khi lưu lớp!");
    } finally {
        btnClassStudentsSave.disabled = false;
        btnClassStudentsSave.innerText = originalText;
    }
}

async function notifyStudentsAddedToClass(newIds, previousIds, className) {
    const newlyAdded = newIds.filter(id => !previousIds.includes(id));
    if (newlyAdded.length === 0) return;

    const batch = db.batch();

    newlyAdded.forEach(studentId => {
        const notiRef = db.collection("students").doc(studentId).collection("notifications").doc();
        batch.set(notiRef, {
            type: "class_assigned",
            className: className,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
}

//=========================
// MODAL: XEM CHI TIẾT LỚP
//=========================

function openClassView(classId) {
    currentViewClassId = classId;
    renderClassView(classId);
    modalClassView.classList.add("active");
}

function renderClassView(classId) {
    const cls = allClasses.find(c => c.id === classId);
    if (!cls) return;

    classViewTitle.innerText = `🏫 ${cls.name}`;
    classViewStudents.innerHTML = "";

    const studentIds = cls.studentIds || [];
    const students = allStudents.filter(s => studentIds.includes(s.id));

    if (students.length === 0) {
        classViewEmpty.style.display = "block";
        return;
    }

    classViewEmpty.style.display = "none";

    students.forEach(s => {
        const row = document.createElement("div");
        row.className = "class-view-student-row";
        row.innerHTML = `<h4>${escapeHtml(s.name || "(Không tên)")}</h4><p style="font-size:11px; color:#aaa; user-select:all; margin:0;">ID: ${s.id}</p>`;
        classViewStudents.appendChild(row);
    });
}

//=========================
// STUDENTS TAB
//=========================

function wireStudentsTab() {
    inputStudentsSearch.addEventListener("input", () => {
        renderStudentsTab(inputStudentsSearch.value.trim().toLowerCase());
    });
}

function renderStudentsTab(filter) {
    filter = filter || "";
    studentsContainer.innerHTML = "";

    const filtered = allStudents.filter(s =>
        !filter || (s.name || "").toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        studentsEmpty.style.display = "block";
        return;
    }

    studentsEmpty.style.display = "none";

    filtered.forEach(s => {
        const pending = pendingNameChanges[s.id];
        const classNames = getStudentClassNames(s.id);

        const card = document.createElement("div");
        card.className = "item-card";
        card.innerHTML = `
            <div class="card-header">
                <h2>
                    ${escapeHtml(s.name || "(Không tên)")}
                    ${s.isAdmin ? `<span class="badge-admin">ADMIN</span>` : ""}
                </h2>
            </div>
            <div class="card-info">
                <p>🏫 ${escapeHtml(classNames.join(", ") || "Chưa xếp lớp")}</p>
                <p style="font-size:11px; color:#aaa; user-select:all;">ID: ${s.id}</p>
                ${pending ? `<p class="muted-request">Đổi tên: ${escapeHtml(pending.oldName)} → ${escapeHtml(pending.newName)}</p>` : ""}
            </div>
            <div class="card-buttons">
                <button class="btn-view">View</button>
                <button class="${s.isAdmin ? "btn-admin-remove" : "btn-admin-add"}">
                    ${s.isAdmin ? "Remove Admin" : "Add Admin"}
                </button>
            </div>
        `;

        card.querySelector(".btn-view").addEventListener("click", () => openStudentDetail(s.id));
        card.querySelectorAll(".card-buttons button")[1].addEventListener("click", () => toggleAdmin(s));

        studentsContainer.appendChild(card);
    });
}

async function toggleAdmin(student) {
    const newValue = !student.isAdmin;
    try {
        await db.collection("students").doc(student.id).update({ isAdmin: newValue });
        student.isAdmin = newValue;
        showToast(newValue ? "Đã cấp quyền Admin." : "Đã gỡ quyền Admin.");
        renderStudentsTab(inputStudentsSearch.value.trim().toLowerCase());
    } catch (error) {
        console.error(error);
        alert("Có lỗi khi cập nhật quyền!");
    }
}

//=========================
// MODAL: CHI TIẾT HỌC SINH
//=========================

function wireStudentDetailModal() {
    detailBtnClose.addEventListener("click", () => {
        modalStudentDetail.classList.remove("active");
    });
}

async function openStudentDetail(studentId) {
    const s = allStudents.find(st => st.id === studentId);
    if (!s) return;

    detailStudentName.innerText = s.name || "(Không tên)";
    detailStudentClass.innerText = `Lớp: ${getStudentClassNames(studentId).join(", ") || "Chưa xếp lớp"}`;
    detailStudentAdmin.innerText = s.isAdmin ? "Quyền: Admin" : "Quyền: Học sinh";
    detailStudentAdmin.innerHTML += ` <span style="font-size:11px; color:#aaa; user-select:all;">(ID: ${studentId})</span>`;

    detailRequestsList.innerHTML = "Đang tải...";
    detailAssignmentsList.innerHTML = "Đang tải...";
    modalStudentDetail.classList.add("active");

    loadStudentAssignments(studentId);

    try {
        const snap = await db
            .collection("students").doc(studentId)
            .collection("nameChangeRequests")
            .orderBy("createdAt", "desc")
            .get();

        detailRequestsList.innerHTML = "";

        if (snap.empty) {
            detailRequestsList.innerHTML = `<p style="color:#999;">Chưa có yêu cầu nào.</p>`;
        } else {
            snap.forEach(doc => {
                const req = doc.data();
                const isPending = req.status === "pending";

                const item = document.createElement("div");
                item.className = "request-item";
                item.innerHTML = `
                    <p style="margin:0;"><b>${escapeHtml(req.oldName)}</b> → <b>${escapeHtml(req.newName)}</b></p>
                    <p style="margin:2px 0 8px; font-size:12px; color:#999;">
                        ${isPending ? "⏳ Đang chờ duyệt" : "✅ Đã duyệt"}
                    </p>
                    ${isPending ? `<button class="btn btn-success" style="padding:8px 16px; font-size:13px;">Accept</button>` : ""}
                `;

                if (isPending) {
                    item.querySelector("button").addEventListener("click", () =>
                        acceptNameChange(studentId, doc.id, req.oldName, req.newName)
                    );
                }

                detailRequestsList.appendChild(item);
            });
        }
    } catch (error) {
        console.error(error);
        detailRequestsList.innerHTML = `<p style="color:#999;">Có lỗi khi tải yêu cầu.</p>`;
    }
}

//=========================
// Bài tập đã giao - hiện dấu ✅ (đã làm/nộp) hoặc ❌ (chưa làm) cho từng bài
//=========================

async function loadStudentAssignments(studentId) {
    try {
        const snap = await db
            .collection("assignments")
            .where("studentId", "==", studentId)
            .get();

        detailAssignmentsList.innerHTML = "";

        if (snap.empty) {
            detailAssignmentsList.innerHTML = `<p style="color:#999;">Chưa được giao bài tập nào.</p>`;
            return;
        }

        // Bài mới giao hiện lên trước (nếu có trường assignedAt)
        const docs = snap.docs.sort((a, b) => {
            const ta = a.data().assignedAt && a.data().assignedAt.toMillis ? a.data().assignedAt.toMillis() : 0;
            const tb = b.data().assignedAt && b.data().assignedAt.toMillis ? b.data().assignedAt.toMillis() : 0;
            return tb - ta;
        });

        docs.forEach(doc => {
            const a = doc.data();
            const isDone = a.status === "done";

            const scoreText = (isDone && a.score && a.score.total > 0)
                ? ` — ${a.score.correct}/${a.score.total} điểm`
                : "";

            const row = document.createElement("div");
            row.className = "assignment-status-row";
            row.innerHTML = `
                <span>📖 ${escapeHtml(a.homeworkName || "Bài tập")}${scoreText}</span>
                <span class="status-icon ${isDone ? "done" : "pending"}">${isDone ? "✅" : "❌"}</span>
            `;
            detailAssignmentsList.appendChild(row);
        });

    } catch (error) {
        console.error("Lỗi khi tải bài tập đã giao:", error);
        detailAssignmentsList.innerHTML = `<p style="color:#999;">Có lỗi khi tải bài tập.</p>`;
    }
}

async function acceptNameChange(studentId, reqId, oldName, newName) {
    try {
        const batch = db.batch();

        const studentRef = db.collection("students").doc(studentId);
        batch.update(studentRef, { name: newName });

        const reqRef = studentRef.collection("nameChangeRequests").doc(reqId);
        batch.update(reqRef, {
            status: "accepted",
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const notiRef = studentRef.collection("notifications").doc();
        batch.set(notiRef, {
            type: "name_change_result",
            oldName: oldName,
            newName: newName,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        showToast("Đã duyệt đổi tên!");
        modalStudentDetail.classList.remove("active");

        await loadStudents();

    } catch (error) {
        console.error(error);
        alert("Có lỗi khi duyệt yêu cầu!");
    }
}

//=========================
// Helpers
//=========================

function escapeHtml(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
}
