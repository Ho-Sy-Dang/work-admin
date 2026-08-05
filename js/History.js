(function () {

    const container = document.querySelector(".container");
    const toastContainer = document.getElementById("toast-container");

    // Cache nhanh dữ liệu bài tập theo ID (dùng cho modal "View" kết quả,
    // khỏi phải gọi lại Firestore để lấy tên bài).
    let homeworksById = {};

    function showToast(text) {
        toastContainer.innerHTML = "";
        const div = document.createElement("div");
        div.className = "toast";
        div.innerHTML = text;
        toastContainer.appendChild(div);
        setTimeout(() => div.classList.add("show"), 100);
        setTimeout(() => div.classList.remove("show"), 3000);
    }

    function formatDate(timestamp) {
        if (!timestamp) return "Không rõ";
        return timestamp.toDate().toLocaleString();
    }

    async function renderList() {

        container.innerHTML = `
            <h1>History</h1>
            <p>Danh sách bài tập đã tạo</p>
        `;

        const snapshot = await db
            .collection("homeworks")
            .orderBy("createdAt", "desc")
            .get();

        if (snapshot.empty) {

            container.innerHTML += `
                <div class="empty-card">
                    <h2>📚</h2>
                    <h3>Chưa có bài tập nào</h3>
                </div>
            `;

            return;

        }

        homeworksById = {};

        snapshot.forEach((doc) => {

            const hw = doc.data();
            homeworksById[doc.id] = hw;

            const card = document.createElement("div");

            card.className = "item-card";

            card.innerHTML = `

                <div class="card-header">
                    <h2>${hw.category === "listening" ? "🎧" : "📖"} ${hw.name}</h2>
                </div>

                <div class="card-info">

                    <p>
                        ${hw.category === "listening" ? "🎧 Listening" : "📖 Reading"}
                        &nbsp;·&nbsp;
                        ${hw.mode === "shared" ? "🌐 Chung" : "🔒 Riêng"}
                    </p>

                    <p>
                        🆔 ${doc.id}
                    </p>

                    <p>
                        📅 ${formatDate(hw.createdAt)}
                    </p>

                </div>

                <div class="card-buttons">

                    <button
                        class="btn-view"
                        onclick="viewHomeworkResults('${doc.id}')">

                        View

                    </button>

                    <button
                        class="btn-edit"
                        onclick="editHomework('${doc.id}')">

                        Edit

                    </button>

                    <button
                        class="btn-update"
                        onclick="updateHomework('${doc.id}')">

                        Update

                    </button>

                    <button
                        class="btn-delete"
                        onclick="deleteHomework('${doc.id}')">

                        Delete

                    </button>

                </div>

            `;

            container.appendChild(card);

        });

    }

    window.editHomework = function(id){
        console.log("Edit ID =", id);
        localStorage.setItem("edit_homework_id", id);
        window.location.href = "Add.html";
    };

    //=========================================================
    // VIEW - xem những ai đã làm bài tập này và điểm số của họ
    //=========================================================

    // Toàn bộ style của modal viết inline / trong <style> riêng, cùng cách
    // làm với ensureAssignModal() bên dưới, để không phụ thuộc CSS trang khác.
    function ensureViewModal() {
        if (document.getElementById("view-modal-overlay")) return;

        const styleTag = document.createElement("style");
        styleTag.innerHTML = `
            #view-modal-overlay .view-summary {
                font-weight: bold;
                color: #0099ff;
                margin-bottom: 14px;
            }
            #view-modal-overlay .view-list {
                max-height: 420px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-right: 4px;
                margin-bottom: 16px;
            }
            #view-modal-overlay .view-row {
                display: grid;
                grid-template-columns: 1fr auto auto;
                align-items: center;
                gap: 14px;
                background: #f7fbff;
                border: 2px solid #e1f3ff;
                border-radius: 10px;
                padding: 10px 14px;
            }
            #view-modal-overlay .view-row-name {
                font-weight: 600;
                color: #000;
            }
            #view-modal-overlay .view-row-status {
                font-size: 13px;
                white-space: nowrap;
            }
            #view-modal-overlay .view-row-status.done { color: #00b368; }
            #view-modal-overlay .view-row-status.pending { color: #999; }
            #view-modal-overlay .view-row-score {
                font-weight: bold;
                color: #0099ff;
                white-space: nowrap;
                min-width: 90px;
                text-align: right;
            }
            #view-modal-overlay .assign-empty {
                color: #999;
                font-size: 13px;
            }
        `;
        document.head.appendChild(styleTag);

        const overlay = document.createElement("div");
        overlay.id = "view-modal-overlay";
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal-box" style="max-width: 640px;">
                <h3 style="margin-bottom: 6px; color:#000;">📊 Kết quả bài tập</h3>
                <p id="view-hw-name" style="color:#0099ff; font-weight:bold; margin-bottom: 6px;"></p>
                <p id="view-summary" class="view-summary"></p>

                <div id="view-results-list" class="view-list"></div>

                <div class="action-bar" style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-secondary" id="view-btn-close">Đóng</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById("view-btn-close").addEventListener("click", () => {
            overlay.classList.remove("active");
        });
    }

    window.viewHomeworkResults = async function (id) {

        ensureViewModal();

        const hw = homeworksById[id] || {};
        const listEl = document.getElementById("view-results-list");

        document.getElementById("view-hw-name").innerText = hw.name || "";
        document.getElementById("view-summary").innerText = "";
        listEl.innerHTML = `<p class="assign-empty">Đang tải...</p>`;

        document.getElementById("view-modal-overlay").classList.add("active");

        try {

            const [assignSnap, studentsSnap] = await Promise.all([
                db.collection("assignments").where("homeworkId", "==", id).get(),
                db.collection("students").get()
            ]);

            if (assignSnap.empty) {
                listEl.innerHTML = `<p class="assign-empty">Chưa giao bài tập này cho ai.</p>`;
                return;
            }

            const studentMap = {};
            studentsSnap.forEach(d => { studentMap[d.id] = d.data(); });

            const rows = assignSnap.docs.map(d => {
                const a = d.data();
                const student = studentMap[a.studentId] || {};
                return {
                    name: student.name || "(Không rõ tên)",
                    done: a.status === "done",
                    score: a.score || null
                };
            });

            // Đã làm (điểm cao -> thấp) hiện trước, chưa làm xếp dưới cùng
            rows.sort((x, y) => {
                if (x.done !== y.done) return x.done ? -1 : 1;
                if (x.done) {
                    const px = x.score && x.score.total ? x.score.correct / x.score.total : 0;
                    const py = y.score && y.score.total ? y.score.correct / y.score.total : 0;
                    return py - px;
                }
                return x.name.localeCompare(y.name);
            });

            const doneCount = rows.filter(r => r.done).length;
            document.getElementById("view-summary").innerText =
                `${doneCount}/${rows.length} học sinh đã hoàn thành`;

            listEl.innerHTML = rows.map(r => {

                let scoreText = "—";
                if (r.done) {
                    scoreText = (r.score && r.score.total > 0)
                        ? `${r.score.correct}/${r.score.total} (${Math.round(r.score.correct / r.score.total * 100)}%)`
                        : "Đã nộp";
                }

                return `
                    <div class="view-row">
                        <div class="view-row-name">${escapeAssign(r.name)}</div>
                        <div class="view-row-status ${r.done ? "done" : "pending"}">
                            ${r.done ? "✅ Đã làm" : "⏳ Chưa làm"}
                        </div>
                        <div class="view-row-score">${scoreText}</div>
                    </div>
                `;
            }).join("");

        } catch (error) {
            console.error(error);
            listEl.innerHTML = `<p class="assign-empty">Có lỗi khi tải kết quả, vui lòng thử lại!</p>`;
        }
    };

    //=========================================================
    // UPDATE - chọn Lớp và/hoặc Học sinh để giao bài tập
    //=========================================================

    let pickedStudentIds = new Set();
    let pickedClassIds = new Set();

    let allStudentsForAssign = [];
    let allClassesForAssign = [];
    let currentHomeworkId = null;
    let currentHomeworkData = null;

    // Toàn bộ style của modal viết inline / trong <style> riêng để không phụ
    // thuộc vào việc trang History.html có load đủ css của trang khác hay không.
    function ensureAssignModal() {
        if (document.getElementById("assign-modal-overlay")) return;

        const styleTag = document.createElement("style");
        styleTag.innerHTML = `
            #assign-modal-overlay .assign-col-title {
                font-weight: bold;
                color: #0099ff;
                margin-bottom: 10px;
                font-size: 15px;
            }
            #assign-modal-overlay .assign-list {
                max-height: 340px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-right: 4px;
            }
            #assign-modal-overlay .assign-row {
                display: flex;
                align-items: center;
                gap: 12px;
                background: #f7fbff;
                border: 2px solid #e1f3ff;
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
            }
            #assign-modal-overlay .assign-row:hover {
                border-color: #6EC6FF;
            }
            #assign-modal-overlay .assign-row.checked {
                border-color: #0099ff;
                background: #e8f8ff;
            }
            #assign-modal-overlay .assign-row input[type="checkbox"] {
                width: 18px;
                height: 18px;
                flex-shrink: 0;
                accent-color: #0099ff;
                pointer-events: none;
            }
            #assign-modal-overlay .assign-row .assign-row-text {
                color: #000;
            }
            #assign-modal-overlay .assign-row .assign-row-text h4 {
                margin: 0;
                font-size: 15px;
                color: #000;
                font-weight: 600;
            }
            #assign-modal-overlay .assign-row .assign-row-text p {
                margin: 2px 0 0;
                font-size: 12px;
                color: #000;
            }
            #assign-modal-overlay .assign-columns {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 16px;
            }
            #assign-modal-overlay .assign-empty {
                color: #999;
                font-size: 13px;
            }
        `;
        document.head.appendChild(styleTag);

        const overlay = document.createElement("div");
        overlay.id = "assign-modal-overlay";
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal-box" style="max-width: 720px;">
                <h3 style="margin-bottom: 6px; color:#000;">Chọn Lớp / Học sinh để giao bài</h3>
                <p id="assign-hw-name" style="color:#0099ff; font-weight:bold; margin-bottom: 14px;"></p>

                <input type="text" id="assign-search" placeholder="🔍 Tìm lớp hoặc học sinh..."
                    style="width:100%; padding:10px; border:2px solid #e1f3ff; border-radius:10px; margin-bottom:16px; outline:none; box-sizing:border-box; color:#000;">

                <div class="assign-columns">
                    <div>
                        <div class="assign-col-title">🏫 Lớp</div>
                        <div id="assign-class-list" class="assign-list"></div>
                    </div>
                    <div>
                        <div class="assign-col-title">🧑‍🎓 Học sinh</div>
                        <div id="assign-student-list" class="assign-list"></div>
                    </div>
                </div>

                <div class="action-bar" style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" id="assign-btn-cancel">Cancel</button>
                    <button class="btn btn-primary" id="assign-btn-confirm">Update</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById("assign-btn-cancel").addEventListener("click", closeAssignModal);
        document.getElementById("assign-search").addEventListener("input", (e) => {
            renderAssignLists(e.target.value.trim().toLowerCase());
        });
    }

    function closeAssignModal() {
        const overlay = document.getElementById("assign-modal-overlay");
        if (overlay) overlay.classList.remove("active");
    }

    function escapeAssign(str) {
        const div = document.createElement("div");
        div.innerText = str;
        return div.innerHTML;
    }

    function renderAssignLists(filter) {
        renderAssignClassColumn(filter);
        renderAssignStudentColumn(filter);
    }

    function renderAssignClassColumn(filter) {
        const listEl = document.getElementById("assign-class-list");
        listEl.innerHTML = "";

        const filtered = allClassesForAssign.filter(c =>
            !filter || (c.name || "").toLowerCase().includes(filter)
        );

        if (filtered.length === 0) {
            listEl.innerHTML = `<p class="assign-empty">Không có lớp nào.</p>`;
            return;
        }

        filtered.forEach(c => {
            const checked = pickedClassIds.has(c.id);
            const count = (c.studentIds || []).length;

            const row = document.createElement("div");
            row.className = "assign-row" + (checked ? " checked" : "");
            row.innerHTML = `
                <input type="checkbox" ${checked ? "checked" : ""}>
                <div class="assign-row-text">
                    <h4>${escapeAssign(c.name || "(Không tên)")}</h4>
                    <p>${count} học sinh</p>
                </div>
            `;
            row.addEventListener("click", () => {
                if (pickedClassIds.has(c.id)) pickedClassIds.delete(c.id);
                else pickedClassIds.add(c.id);
                renderAssignClassColumn(filter);
            });
            listEl.appendChild(row);
        });
    }

    function renderAssignStudentColumn(filter) {
        const listEl = document.getElementById("assign-student-list");
        listEl.innerHTML = "";

        const filtered = allStudentsForAssign.filter(s =>
            !filter || (s.name || "").toLowerCase().includes(filter)
        );

        if (filtered.length === 0) {
            listEl.innerHTML = `<p class="assign-empty">Không có học sinh nào.</p>`;
            return;
        }

        filtered.forEach(s => {
            const checked = pickedStudentIds.has(s.id);
            const classNames = allClassesForAssign
                .filter(c => (c.studentIds || []).includes(s.id))
                .map(c => c.name);

            const row = document.createElement("div");
            row.className = "assign-row" + (checked ? " checked" : "");
            row.innerHTML = `
                <input type="checkbox" ${checked ? "checked" : ""}>
                <div class="assign-row-text">
                    <h4>${escapeAssign(s.name || "(Không tên)")}</h4>
                    <p>${escapeAssign(classNames.join(", ") || "Chưa xếp lớp")}</p>
                </div>
            `;
            row.addEventListener("click", () => {
                if (pickedStudentIds.has(s.id)) pickedStudentIds.delete(s.id);
                else pickedStudentIds.add(s.id);
                renderAssignStudentColumn(filter);
            });
            listEl.appendChild(row);
        });
    }

    window.updateHomework = async function (id) {

        ensureAssignModal();
        pickedStudentIds = new Set();
        pickedClassIds = new Set();
        currentHomeworkId = id;

        const hwDoc = await db.collection("homeworks").doc(id).get();
        if (!hwDoc.exists) {
            alert("Không tìm thấy bài tập này!");
            return;
        }
        currentHomeworkData = hwDoc.data();

        document.getElementById("assign-hw-name").innerText = currentHomeworkData.name || "";

        const [studentsSnap, classesSnap] = await Promise.all([
            db.collection("students").orderBy("name").get(),
            db.collection("classes").orderBy("name").get()
        ]);

        allStudentsForAssign = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allClassesForAssign = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        document.getElementById("assign-search").value = "";
        renderAssignLists("");

        document.getElementById("assign-modal-overlay").classList.add("active");

        document.getElementById("assign-btn-confirm").onclick = confirmAssign;
    };

    async function confirmAssign() {

        // Gộp: học sinh được chọn trực tiếp + toàn bộ học sinh trong các lớp được chọn
        const finalStudentIds = new Set(pickedStudentIds);

        pickedClassIds.forEach(classId => {
            const cls = allClassesForAssign.find(c => c.id === classId);
            (cls?.studentIds || []).forEach(sid => finalStudentIds.add(sid));
        });

        if (finalStudentIds.size === 0) {
            alert("Vui lòng chọn ít nhất 1 lớp hoặc 1 học sinh!");
            return;
        }

        const btn = document.getElementById("assign-btn-confirm");
        btn.disabled = true;
        btn.innerText = "Đang giao bài...";

        try {

            // Mỗi bài tập chỉ giao lại đúng 1 lần / 1 học sinh (ID cố định), để:
            // - Không tạo bản ghi trùng lặp khi bấm Update nhiều lần.
            // - Không copy nội dung bài (parts/category/mode) vào assignment, mà
            //   để phía User luôn đọc trực tiếp từ "homeworks/{id}" theo thời gian
            //   thực -> Admin sửa bài ở đâu, User thấy ngay ở đó.
            const ops = Array.from(finalStudentIds).map(async (studentId) => {

                const ref = db.collection("assignments").doc(`${currentHomeworkId}_${studentId}`);
                const existing = await ref.get();

                if (existing.exists) {
                    // Đã giao từ trước -> chỉ cập nhật thời điểm giao lại, KHÔNG
                    // đụng vào status/score nếu học sinh đã làm xong bài.
                    await ref.set({
                        studentId: studentId,
                        homeworkId: currentHomeworkId,
                        assignedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } else {
                    await ref.set({
                        studentId: studentId,
                        homeworkId: currentHomeworkId,
                        status: "assigned",
                        assignedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            await Promise.all(ops);

            showToast(`Đã giao bài cho ${finalStudentIds.size} học sinh!`);
            closeAssignModal();

        } catch (error) {
            console.error(error);
            alert("Có lỗi khi giao bài tập!");
        } finally {
            btn.disabled = false;
            btn.innerText = "Update";
        }
    }

    window.deleteHomework = async function(id){
        const ok = confirm("Bạn có chắc muốn xóa?");
        if(!ok) return;
        await db.collection("homeworks").doc(id).delete();
        renderList();
    };

    renderList();

})();
