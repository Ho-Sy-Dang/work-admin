/*====================================================
    ADD.JS

    Cấu trúc bài tập gồm 2 tầng lựa chọn:

    1) MODE (tab lớn): "private" (Riêng) hoặc "shared" (Chung)
       - Riêng : Reading có 2 vùng nhập riêng biệt Question + Reading.
       - Chung : Reading chỉ có 1 vùng nhập duy nhất "Đề Bài"
                 (đoạn văn/ảnh + trắc nghiệm ở phần Đáp án đúng).

    2) CATEGORY (tab nhỏ): "reading" hoặc "listening"
       - Listening giữ NGUYÊN cấu trúc cho cả 2 mode: 1 file nghe
         (audio) ở trên + 1 Đề bài (Ảnh hoặc Chữ) ở dưới.
         Part 1,3,4 là trắc nghiệm, Part 2,5 là điền đáp án.

    TYPE (Ảnh/Chữ) áp dụng cho vùng nhập đang hiển thị, tùy theo
    tổ hợp (mode, category) hiện tại.
====================================================*/

const TOTAL_PARTS = 5;

let currentPart = 1;

let isEdit = false;

let editID = null;

//=========================
// Cấu trúc dữ liệu
//=========================

// Mỗi field (question / reading / task / prompt) đều có thể chứa
// Ảnh (file/preview/url) hoặc Chữ (text).
function newField() {
    return { file: null, preview: null, url: null, text: "" };
}

// Mỗi câu hỏi trắc nghiệm: đáp án đúng (A/B/C/...) + số lượng lựa chọn (mặc định 4: A-D).
function newAnswerItem() {
    return { correct: null, optionsCount: 4 };
}

// Mỗi câu điền từ: đáp án đúng là 1 đoạn chữ (không phải A/B/C/D)
function newFillItem() {
    return { correctText: "" };
}

function newAnswerList() {
    return [newAnswerItem(), newAnswerItem(), newAnswerItem(), newAnswerItem(), newAnswerItem()];
}

function newFillList() {
    return [newFillItem(), newFillItem(), newFillItem(), newFillItem(), newFillItem()];
}

// Chuẩn hóa 1 phần tử đáp án trắc nghiệm về format mới { correct, optionsCount }
// (tương thích ngược với dữ liệu cũ - chỉ là chuỗi "A"/"B"/... hoặc null)
function normalizeAnswerItem(a) {
    if (a && typeof a === "object" && "optionsCount" in a) return a;
    if (typeof a === "string" || a === null || a === undefined) {
        return { correct: a || null, optionsCount: 4 };
    }
    return newAnswerItem();
}

function normalizeFillItem(a) {
    if (a && typeof a === "object" && "correctText" in a) return a;
    return newFillItem();
}

// Chữ cái tương ứng với vị trí lựa chọn: 0 -> A, 1 -> B, 2 -> C, ...
function letterFor(index) {
    return String.fromCharCode(65 + index);
}

// Part 1, 3, 4 -> trắc nghiệm (choice). Part 2, 5 -> điền đáp án (fill).
// (Chỉ áp dụng cho Listening - Reading luôn là trắc nghiệm.)
function questionTypeForPart(partIndex) {
    return (partIndex === 2 || partIndex === 5) ? "fill" : "choice";
}

// RIÊNG -> Reading: Question + Reading tách biệt.
function newReadingPrivatePart() {
    return {
        question: newField(),
        reading: newField(),
        answers: newAnswerList(),
        fillIn: newFillInConfig()
    };
}

// CHUNG -> Reading: chỉ 1 vùng nhập "Đề Bài".
function newReadingSharedPart() {
    return {
        task: newField(),
        answers: newAnswerList(),
        fillIn: newFillInConfig()
    };
}

// Cấu hình "Fill in the blanks" - mặc định TẮT, không ảnh hưởng gì tới
// bài trắc nghiệm thường cho tới khi Admin bấm bật.
function newFillInConfig() {
    return {
        enabled: false,
        answers: newFillList()
    };
}

// Listening: giống nhau cho cả 2 mode.
function newListeningPart(partIndex) {
    const qType = questionTypeForPart(partIndex);
    return {
        audio: { url: null, preview: null, uploading: false, mimeType: null },
        prompt: newField(),
        questionType: qType,
        answers: qType === "fill" ? newFillList() : newAnswerList()
    };
}

function buildInitialParts(mode, category) {
    const result = {};
    for (let i = 1; i <= TOTAL_PARTS; i++) {
        if (category === "listening") {
            result[i] = newListeningPart(i);
        } else if (mode === "shared") {
            result[i] = newReadingSharedPart();
        } else {
            result[i] = newReadingPrivatePart();
        }
    }
    return result;
}

let homeworkData = {

    name: "",

    createdAt: "",

    // "private" (Riêng) hoặc "shared" (Chung)
    mode: "private",

    // "reading" hoặc "listening" - quyết định toàn bộ cấu trúc bài
    category: "reading",

    // "image" hoặc "text" - áp dụng cho vùng nhập đang hiển thị
    type: "image",

    parts: {}

};

homeworkData.parts = buildInitialParts(homeworkData.mode, homeworkData.category);

//=========================
// DOM
//=========================

// Mode (Riêng / Chung)
const btnModePrivate = document.getElementById("btn-mode-private");
const btnModeShared = document.getElementById("btn-mode-shared");

// Category (Reading / Listening)
const btnSectionReading = document.getElementById("btn-section-reading");
const btnSectionListening = document.getElementById("btn-section-listening");

const readingPrivateFields = document.getElementById("reading-private-fields");
const readingSharedFields = document.getElementById("reading-shared-fields");
const listeningFields = document.getElementById("listening-fields");

// Type (Ảnh / Chữ)
const btnTypeImage = document.getElementById("btn-type-image");
const btnTypeText = document.getElementById("btn-type-text");

// Riêng -> Reading: Question + Reading
const workspaceImage = document.getElementById("workspace-image");
const workspaceText = document.getElementById("workspace-text");

const cardQuestion = document.getElementById("card-question");
const cardReading = document.getElementById("card-reading");
const inputQuestion = document.getElementById("input-question");
const inputReading = document.getElementById("input-reading");

const textQuestion = document.getElementById("text-question");
const textReading = document.getElementById("text-reading");

// Chung -> Reading: Đề Bài (1 vùng duy nhất)
const examWorkspaceImage = document.getElementById("exam-workspace-image");
const examWorkspaceText = document.getElementById("exam-workspace-text");
const cardExam = document.getElementById("card-exam");
const inputExam = document.getElementById("input-exam");
const textExam = document.getElementById("text-exam");

// Listening: audio
const audioUploadCard = document.getElementById("audio-upload-card");
const inputAudio = document.getElementById("input-audio");
const audioPlaceholder = document.getElementById("audio-placeholder");
const audioPlayerWrap = document.getElementById("audio-player-wrap");
const audioPlayerSlot = document.getElementById("audio-player-slot");
const btnRemoveAudio = document.getElementById("btn-remove-audio");

// Listening: đề bài (prompt)
const taskWorkspaceImage = document.getElementById("task-workspace-image");
const taskWorkspaceText = document.getElementById("task-workspace-text");
const cardTask = document.getElementById("card-task");
const inputTask = document.getElementById("input-task");
const textTask = document.getElementById("text-task");

// Đáp án đúng
const answerKeyTitle = document.getElementById("answer-key-title");
const answerKeyList = document.getElementById("answer-key-list");
const answerCountLabel = document.getElementById("answer-count-label");
const btnAnswerPlus = document.getElementById("btn-answer-plus");
const btnAnswerMinus = document.getElementById("btn-answer-minus");

// Fill in the blanks (chỉ Reading)
const fillinToggleSection = document.getElementById("fillin-toggle-section");
const btnFillinToggle = document.getElementById("btn-fillin-toggle");
const fillinConfigSection = document.getElementById("fillin-config-section");
const fillinList = document.getElementById("fillin-list");
const fillinCountLabel = document.getElementById("fillin-count-label");
const btnFillinPlus = document.getElementById("btn-fillin-plus");
const btnFillinMinus = document.getElementById("btn-fillin-minus");

const partTitle = document.getElementById("part-title");
const progressBar = document.getElementById("progress-bar");
const btnBack = document.getElementById("btn-back");
const btnNext = document.getElementById("btn-next");
const btnDone = document.getElementById("btn-done");

const modal = document.getElementById("modal-confirm");
const homeworkName = document.getElementById("homework-name");
const btnSave = document.getElementById("btn-modal-save");
const btnCancel = document.getElementById("btn-modal-cancel");

const toastContainer = document.getElementById("toast-container");

//=========================
// Kiểm tra Firebase
//=========================

if (typeof firebase === "undefined") {
    alert("Firebase chưa được tải!");
    throw new Error("Firebase Missing");
}

if (typeof db === "undefined") {
    alert("Firestore chưa khởi tạo!");
    throw new Error("Firestore Missing");
}

//=========================
// Loading Edit
//=========================

editID = localStorage.getItem("edit_homework_id");
isEdit = editID !== null;

// Xóa ngay sau khi đọc để cờ này chỉ áp dụng cho ĐÚNG 1 lần điều hướng
// từ History > Edit. Nếu không xóa, mỗi lần bấm "Add" ở thanh nav sau đó
// vẫn sẽ bị hiểu nhầm là đang sửa bài tập cũ.
localStorage.removeItem("edit_homework_id");

//=========================
// Khởi động
//=========================

window.onload = function () {
    updatePart();
    syncModeUI();

    if (isEdit) {
        loadHomework();
    }
};

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

/*====================================================
    Kiểm tra dữ liệu đã nhập (dùng để cảnh báo trước khi đổi
    Mode/Category, tránh mất dữ liệu ngoài ý muốn)
====================================================*/

function checkHasAnyData() {
    for (let i = 1; i <= TOTAL_PARTS; i++) {
        const part = homeworkData.parts[i];
        if (!part) continue;

        if (homeworkData.category === "listening") {
            if (part.audio && (part.audio.url || part.audio.preview)) return true;
            if (part.prompt && (part.prompt.url || part.prompt.preview || part.prompt.text)) return true;
        } else if (homeworkData.mode === "shared") {
            if (part.task && (part.task.url || part.task.preview || part.task.text)) return true;
            if (part.fillIn && hasFillInData(part.fillIn)) return true;
        } else {
            if (part.question && (part.question.url || part.question.preview || part.question.text)) return true;
            if (part.reading && (part.reading.url || part.reading.preview || part.reading.text)) return true;
            if (part.fillIn && hasFillInData(part.fillIn)) return true;
        }
    }
    return false;
}

// "Fill in the blanks" được coi là có dữ liệu nếu đang bật, hoặc có ít
// nhất 1 đáp án đã được nhập (kể cả khi đang tắt).
function hasFillInData(fillIn) {
    if (fillIn.enabled) return true;
    return (fillIn.answers || []).some(a => a.correctText && a.correctText.trim());
}

/*====================================================
    Chọn Mode: Riêng (private) / Chung (shared)
====================================================*/

function setMode(mode) {
    if (mode === homeworkData.mode) return;

    // Listening có cấu trúc GIỐNG HỆT NHAU ở cả 2 mode -> chỉ đổi nhãn,
    // không mất dữ liệu, không cần xác nhận lại.
    if (homeworkData.category === "listening") {
        homeworkData.mode = mode;
        syncModeUI();
        return;
    }

    // Đang ở Reading: đổi Riêng <-> Chung sẽ đổi cấu trúc field (2 ô <-> 1 ô)
    if (checkHasAnyData()) {
        const ok = confirm("Đổi giữa Riêng/Chung sẽ xóa nội dung Reading đã nhập của Part này trở đi. Bạn có chắc muốn đổi?");
        if (!ok) return;
    }

    homeworkData.mode = mode;
    homeworkData.type = "image";
    homeworkData.parts = buildInitialParts(mode, homeworkData.category);
    currentPart = 1;

    updatePart();
    syncModeUI();
}

btnModePrivate.addEventListener("click", function () {
    setMode("private");
});

btnModeShared.addEventListener("click", function () {
    setMode("shared");
});

/*====================================================
    Chọn Category: Reading / Listening
====================================================*/

function setCategory(category) {
    if (category === homeworkData.category) return;

    if (checkHasAnyData()) {
        const ok = confirm("Đổi giữa Reading/Listening sẽ xóa toàn bộ nội dung đã nhập của bài này. Bạn có chắc muốn đổi?");
        if (!ok) return;
    }

    homeworkData.category = category;
    homeworkData.type = "image";
    homeworkData.parts = buildInitialParts(homeworkData.mode, category);
    currentPart = 1;

    updatePart();
    syncModeUI();
}

btnSectionReading.addEventListener("click", function () {
    setCategory("reading");
});

btnSectionListening.addEventListener("click", function () {
    setCategory("listening");
});

// Đồng bộ toàn bộ giao diện theo (mode, category) hiện tại
function syncModeUI() {
    const mode = homeworkData.mode;
    const category = homeworkData.category;

    btnModePrivate.classList.toggle("active", mode === "private");
    btnModeShared.classList.toggle("active", mode === "shared");

    btnSectionReading.classList.toggle("active", category === "reading");
    btnSectionListening.classList.toggle("active", category === "listening");

    readingPrivateFields.style.display = (category === "reading" && mode === "private") ? "block" : "none";
    readingSharedFields.style.display = (category === "reading" && mode === "shared") ? "block" : "none";
    listeningFields.style.display = category === "listening" ? "block" : "none";

    syncTypeUI();
    syncFillInUI();
    renderAnswerKey();

    if (category === "listening") {
        renderAudioPreview();
    }
}

/*====================================================
    Chọn loại nội dung: Ảnh / Chữ
====================================================*/

function syncTypeUI() {
    const type = homeworkData.type;
    const category = homeworkData.category;
    const mode = homeworkData.mode;

    btnTypeImage.classList.toggle("active", type === "image");
    btnTypeText.classList.toggle("active", type === "text");

    // Ẩn hết, chỉ bật đúng vùng đang cần dùng
    workspaceImage.style.display = "none";
    workspaceText.style.display = "none";
    examWorkspaceImage.style.display = "none";
    examWorkspaceText.style.display = "none";
    taskWorkspaceImage.style.display = "none";
    taskWorkspaceText.style.display = "none";

    if (category === "reading" && mode === "private") {

        workspaceImage.style.display = type === "image" ? "grid" : "none";
        workspaceText.style.display = type === "text" ? "grid" : "none";

        if (type === "image") {
            renderQuestionPreview();
            renderReadingPreview();
        } else {
            syncTextUI();
        }

    } else if (category === "reading" && mode === "shared") {

        examWorkspaceImage.style.display = type === "image" ? "block" : "none";
        examWorkspaceText.style.display = type === "text" ? "block" : "none";

        if (type === "image") {
            renderExamPreview();
        } else {
            syncTextUI();
        }

    } else {
        // Listening
        taskWorkspaceImage.style.display = type === "image" ? "block" : "none";
        taskWorkspaceText.style.display = type === "text" ? "block" : "none";

        if (type === "image") {
            renderTaskPreview();
        } else {
            syncTextUI();
        }
    }
}

btnTypeImage.addEventListener("click", function () {
    homeworkData.type = "image";
    syncTypeUI();
});

btnTypeText.addEventListener("click", function () {
    homeworkData.type = "text";
    syncTypeUI();
});

// Đổ dữ liệu Chữ của Part hiện tại vào đúng ô textarea tương ứng
function syncTextUI() {
    const part = homeworkData.parts[currentPart];
    const category = homeworkData.category;
    const mode = homeworkData.mode;

    if (category === "reading" && mode === "private") {
        textQuestion.value = part.question.text || "";
        textReading.value = part.reading.text || "";
    } else if (category === "reading" && mode === "shared") {
        textExam.value = part.task.text || "";
    } else {
        textTask.value = part.prompt.text || "";
    }
}

textQuestion.addEventListener("input", function () {
    homeworkData.parts[currentPart].question.text = textQuestion.value;
});

textReading.addEventListener("input", function () {
    homeworkData.parts[currentPart].reading.text = textReading.value;
});

textExam.addEventListener("input", function () {
    homeworkData.parts[currentPart].task.text = textExam.value;
});

textTask.addEventListener("input", function () {
    homeworkData.parts[currentPart].prompt.text = textTask.value;
});

/*====================================================
    Upload ảnh + Ctrl V + Drag Drop + Preview
    (dùng chung cho Question / Reading / Đề Bài (Chung) / Đề bài Listening)
====================================================*/

// Bản đồ tra cứu: field key -> {card, input, getField}
function fieldMap() {
    return {
        question: { card: cardQuestion, input: inputQuestion, getField: () => homeworkData.parts[currentPart].question },
        reading: { card: cardReading, input: inputReading, getField: () => homeworkData.parts[currentPart].reading },
        exam: { card: cardExam, input: inputExam, getField: () => homeworkData.parts[currentPart].task },
        prompt: { card: cardTask, input: inputTask, getField: () => homeworkData.parts[currentPart].prompt }
    };
}

const allUploadCards = [cardQuestion, cardReading, cardExam, cardTask];

// Card đang được chọn để Ctrl + V
let activeField = "question";

allUploadCards.forEach(function (card) {
    card.addEventListener("mouseenter", function () {
        if (card === cardQuestion) activeField = "question";
        else if (card === cardReading) activeField = "reading";
        else if (card === cardExam) activeField = "exam";
        else activeField = "prompt";
    });
});

cardQuestion.addEventListener("click", () => { activeField = "question"; inputQuestion.click(); });
cardReading.addEventListener("click", () => { activeField = "reading"; inputReading.click(); });
cardExam.addEventListener("click", () => { activeField = "exam"; inputExam.click(); });
cardTask.addEventListener("click", () => { activeField = "prompt"; inputTask.click(); });

inputQuestion.addEventListener("change", function () {
    if (this.files.length === 0) return;
    handleFile(this.files[0], "question");
    this.value = "";
});

inputReading.addEventListener("change", function () {
    if (this.files.length === 0) return;
    handleFile(this.files[0], "reading");
    this.value = "";
});

inputExam.addEventListener("change", function () {
    if (this.files.length === 0) return;
    handleFile(this.files[0], "exam");
    this.value = "";
});

inputTask.addEventListener("change", function () {
    if (this.files.length === 0) return;
    handleFile(this.files[0], "prompt");
    this.value = "";
});

// Ctrl + V: xác định card mục tiêu dựa vào vị trí chuột đang hover TẠI THỜI ĐIỂM dán,
// thay vì chỉ dựa vào biến activeField (có thể bị "cũ").
window.addEventListener("paste", function (e) {

    if (homeworkData.type === "text") return;

    const items = e.clipboardData.items;

    let targetField = activeField;

    if (cardReading.matches(":hover")) targetField = "reading";
    else if (cardQuestion.matches(":hover")) targetField = "question";
    else if (cardExam.matches(":hover")) targetField = "exam";
    else if (cardTask.matches(":hover")) targetField = "prompt";

    for (let item of items) {
        if (item.kind === "file") {
            const file = item.getAsFile();
            if (!file) continue;
            handleFile(file, targetField);
            break;
        }
    }
});

allUploadCards.forEach(function (card) {

    card.addEventListener("dragover", function (e) {
        e.preventDefault();
        card.classList.add("dragover");
    });

    card.addEventListener("dragleave", function () {
        card.classList.remove("dragover");
    });

});

cardQuestion.addEventListener("drop", function (e) {
    e.preventDefault();
    cardQuestion.classList.remove("dragover");
    if (e.dataTransfer.files.length === 0) return;
    handleFile(e.dataTransfer.files[0], "question");
});

cardReading.addEventListener("drop", function (e) {
    e.preventDefault();
    cardReading.classList.remove("dragover");
    if (e.dataTransfer.files.length === 0) return;
    handleFile(e.dataTransfer.files[0], "reading");
});

cardExam.addEventListener("drop", function (e) {
    e.preventDefault();
    cardExam.classList.remove("dragover");
    if (e.dataTransfer.files.length === 0) return;
    handleFile(e.dataTransfer.files[0], "exam");
});

cardTask.addEventListener("drop", function (e) {
    e.preventDefault();
    cardTask.classList.remove("dragover");
    if (e.dataTransfer.files.length === 0) return;
    handleFile(e.dataTransfer.files[0], "prompt");
});

function handleFile(file, fieldKey) {

    if (!file.type.startsWith("image/")) {
        alert("Chỉ được chọn ảnh!");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const field = fieldMap()[fieldKey].getField();
        field.file = null;
        field.preview = e.target.result;
        field.url = null;
        renderFieldPreview(fieldKey);
    };

    reader.readAsDataURL(file);
}

function renderFieldPreview(fieldKey) {

    const map = fieldMap()[fieldKey];
    const card = map.card;
    const data = map.getField();

    const preview = card.querySelector(".preview");
    const placeholder = card.querySelector(".upload-placeholder");

    preview.innerHTML = "";

    if (!data || (!data.preview && !data.url)) {
        placeholder.style.display = "flex";
        return;
    }

    placeholder.style.display = "none";

    const img = document.createElement("img");
    img.src = data.preview || data.url;
    img.className = "preview-image";
    preview.appendChild(img);

    const action = document.createElement("div");
    action.className = "preview-action";
    action.innerHTML = `
        <button class="btn-delete">Delete</button>
        <button class="btn-replace">Replace</button>
    `;
    preview.appendChild(action);

    action.querySelector(".btn-delete").addEventListener("click", function (e) {
        e.stopPropagation();
        const field = map.getField();
        field.file = null;
        field.preview = null;
        field.url = null;
        renderFieldPreview(fieldKey);
    });

    action.querySelector(".btn-replace").addEventListener("click", function (e) {
        e.stopPropagation();
        map.input.click();
    });
}

function renderQuestionPreview() { renderFieldPreview("question"); }
function renderReadingPreview() { renderFieldPreview("reading"); }
function renderExamPreview() { renderFieldPreview("exam"); }
function renderTaskPreview() { renderFieldPreview("prompt"); }

/*====================================================
    LISTENING: Upload file nghe (mp3/mp4) + Player
====================================================*/

audioUploadCard.addEventListener("click", function () {
    // Chỉ mở hộp thoại chọn file khi CHƯA có file nào (đang hiện placeholder).
    // Muốn thay file khác thì bấm "Xóa file" trước.
    if (audioPlayerWrap.style.display === "flex") return;
    inputAudio.click();
});

inputAudio.addEventListener("change", function () {
    if (this.files.length === 0) return;
    handleAudioFile(this.files[0]);
    this.value = "";
});

audioUploadCard.addEventListener("dragover", function (e) {
    e.preventDefault();
    audioUploadCard.classList.add("dragover");
});

audioUploadCard.addEventListener("dragleave", function () {
    audioUploadCard.classList.remove("dragover");
});

audioUploadCard.addEventListener("drop", function (e) {
    e.preventDefault();
    audioUploadCard.classList.remove("dragover");
    if (e.dataTransfer.files.length === 0) return;
    handleAudioFile(e.dataTransfer.files[0]);
});

btnRemoveAudio.addEventListener("click", function (e) {
    e.stopPropagation();
    homeworkData.parts[currentPart].audio = { url: null, preview: null, uploading: false, mimeType: null };
    renderAudioPreview();
});

async function handleAudioFile(file) {

    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        alert("Chỉ được chọn file âm thanh hoặc video (mp3, mp4)!");
        return;
    }

    const part = homeworkData.parts[currentPart];
    const localUrl = URL.createObjectURL(file);

    part.audio = { url: null, preview: localUrl, uploading: true, mimeType: file.type };
    renderAudioPreview();

    try {
        const uploadedUrl = await uploadAudio(file);
        if (!uploadedUrl) throw new Error("Upload thất bại");

        part.audio = { url: uploadedUrl, preview: null, uploading: false, mimeType: file.type };
        renderAudioPreview();
        showToast("Đã tải file nghe lên!");

    } catch (error) {
        console.error("Lỗi upload file nghe:", error);
        alert("Có lỗi khi tải file nghe lên, vui lòng thử lại!");
        part.audio = { url: null, preview: null, uploading: false, mimeType: null };
        renderAudioPreview();
    }
}

function renderAudioPreview() {

    if (homeworkData.category !== "listening") return;

    const audioData = homeworkData.parts[currentPart].audio || {};

    if (audioData.uploading) {
        audioPlaceholder.style.display = "none";
        audioPlayerWrap.style.display = "flex";
        audioPlayerSlot.innerHTML = `<p style="margin:0; color:#666;">⏳ Đang tải file lên...</p>`;
        return;
    }

    const src = audioData.url || audioData.preview;

    if (!src) {
        audioPlaceholder.style.display = "flex";
        audioPlayerWrap.style.display = "none";
        audioPlayerSlot.innerHTML = "";
        return;
    }

    audioPlaceholder.style.display = "none";
    audioPlayerWrap.style.display = "flex";
    audioPlayerSlot.innerHTML = buildAudioPlayerHTML();
    setupAudioPlayer(audioPlayerSlot, src);
}

// HTML cho 1 player thu gọn: nút Play/Pause, tua lùi/tua tới 10s, thanh kéo, thời gian.
function buildAudioPlayerHTML() {
    return `
        <div class="audio-player">
            <button type="button" class="audio-play-btn">▶️</button>
            <button type="button" class="audio-skip-btn" data-skip="-10">⏪ 10s</button>
            <input type="range" class="audio-seek" min="0" max="100" value="0" step="0.1">
            <span class="audio-time">0:00 / 0:00</span>
            <button type="button" class="audio-skip-btn" data-skip="10">10s ⏩</button>
            <audio class="audio-element" preload="metadata"></audio>
        </div>
    `;
}

function formatAudioTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// Gắn logic điều khiển cho 1 player đã render trong container, với nguồn audio "src".
function setupAudioPlayer(container, src) {

    const audio = container.querySelector(".audio-element");
    const playBtn = container.querySelector(".audio-play-btn");
    const seek = container.querySelector(".audio-seek");
    const timeLabel = container.querySelector(".audio-time");
    const skipBtns = container.querySelectorAll(".audio-skip-btn");

    let isSeeking = false;

    audio.src = src;

    audio.addEventListener("loadedmetadata", function () {
        seek.max = audio.duration || 0;
        timeLabel.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    });

    audio.addEventListener("timeupdate", function () {
        if (!isSeeking) seek.value = audio.currentTime;
        timeLabel.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    });

    audio.addEventListener("ended", function () {
        playBtn.innerText = "▶️";
    });

    playBtn.addEventListener("click", function () {
        if (audio.paused) {
            audio.play();
            playBtn.innerText = "⏸️";
        } else {
            audio.pause();
            playBtn.innerText = "▶️";
        }
    });

    seek.addEventListener("mousedown", () => isSeeking = true);
    seek.addEventListener("touchstart", () => isSeeking = true);
    seek.addEventListener("mouseup", () => { isSeeking = false; audio.currentTime = parseFloat(seek.value); });
    seek.addEventListener("touchend", () => { isSeeking = false; audio.currentTime = parseFloat(seek.value); });
    seek.addEventListener("input", function () {
        if (isSeeking) timeLabel.innerText = `${formatAudioTime(seek.value)} / ${formatAudioTime(audio.duration)}`;
    });

    skipBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            const delta = parseFloat(btn.dataset.skip);
            const maxTime = isFinite(audio.duration) ? audio.duration : Infinity;
            audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), maxTime);
        });
    });
}

/*====================================================
    Đáp án đúng: Trắc nghiệm (choice) hoặc Điền từ (fill)
====================================================*/

function getCurrentQuestionType() {
    if (homeworkData.category !== "listening") return "choice";
    const part = homeworkData.parts[currentPart];
    return part.questionType || "choice";
}

function renderAnswerKey() {

    const part = homeworkData.parts[currentPart];
    const qType = getCurrentQuestionType();

    answerKeyTitle.innerText = qType === "fill"
        ? "✏️ Đáp án đúng (điền đáp án)"
        : "✅ Đáp án đúng (để chấm điểm)";

    if (qType === "fill") {
        renderFillAnswerKey(part);
    } else {
        renderChoiceAnswerKey(part);
    }
}

function renderChoiceAnswerKey(part) {

    if (!Array.isArray(part.answers) || part.answers.length === 0) {
        part.answers = newAnswerList();
    }

    part.answers = part.answers.map(normalizeAnswerItem);

    answerCountLabel.innerText = `${part.answers.length} câu`;
    answerKeyList.innerHTML = "";

    part.answers.forEach(function (item, qIndex) {

        const optionsCount = item.optionsCount || 4;
        const options = [];
        for (let i = 0; i < optionsCount; i++) options.push(letterFor(i));

        const row = document.createElement("div");
        row.className = "answer-row";
        row.innerHTML = `
            <span class="answer-row-label">Câu ${qIndex + 1}</span>
            <div class="answer-options">
                ${options.map(v => `<button type="button" class="opt-btn${item.correct === v ? " selected" : ""}" data-value="${v}">${v}</button>`).join("")}
            </div>
            <div class="option-count-control">
                <button type="button" class="btn-round-adjust-sm opt-minus" title="Bớt 1 lựa chọn">−</button>
                <span class="option-count-label">${optionsCount} lựa chọn</span>
                <button type="button" class="btn-round-adjust-sm opt-plus" title="Thêm 1 lựa chọn">+</button>
            </div>
        `;

        row.querySelectorAll(".opt-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                item.correct = btn.dataset.value;
                renderAnswerKey();
            });
        });

        row.querySelector(".opt-plus").addEventListener("click", function () {
            if (optionsCount >= 12) return;
            item.optionsCount = optionsCount + 1;
            renderAnswerKey();
        });

        row.querySelector(".opt-minus").addEventListener("click", function () {
            if (optionsCount <= 2) return;
            const removedLetter = letterFor(optionsCount - 1);
            item.optionsCount = optionsCount - 1;
            if (item.correct === removedLetter) item.correct = null;
            renderAnswerKey();
        });

        answerKeyList.appendChild(row);
    });
}

function renderFillAnswerKey(part) {

    if (!Array.isArray(part.answers) || part.answers.length === 0) {
        part.answers = newFillList();
    }

    part.answers = part.answers.map(normalizeFillItem);

    answerCountLabel.innerText = `${part.answers.length} câu`;
    answerKeyList.innerHTML = "";

    part.answers.forEach(function (item, qIndex) {

        const row = document.createElement("div");
        row.className = "answer-row fill-row";
        row.innerHTML = `
            <span class="answer-row-label">Câu ${qIndex + 1}</span>
            <input type="text" class="fill-answer-input" placeholder="Đáp án đúng...">
        `;

        const input = row.querySelector(".fill-answer-input");
        input.value = item.correctText || "";

        input.addEventListener("input", function () {
            item.correctText = input.value;
        });

        answerKeyList.appendChild(row);
    });
}

btnAnswerPlus.addEventListener("click", function () {
    const part = homeworkData.parts[currentPart];
    const qType = getCurrentQuestionType();
    if (!part.answers) part.answers = [];
    if (part.answers.length >= 20) return;
    part.answers.push(qType === "fill" ? newFillItem() : newAnswerItem());
    renderAnswerKey();
});

btnAnswerMinus.addEventListener("click", function () {
    const part = homeworkData.parts[currentPart];
    if (!part.answers || part.answers.length <= 1) return;
    part.answers.pop();
    renderAnswerKey();
});

/*====================================================
    Fill in the blanks (chỉ áp dụng cho Reading - Riêng và Chung)

    Đây là tính năng THÊM VÀO bên cạnh trắc nghiệm thường, không thay
    thế. Admin bật/tắt cho từng Part; trạng thái này được lưu trong
    part.fillIn.enabled và gửi kèm bài tập sang phía User:
    - enabled = true  -> User thấy thêm phần điền vào chỗ trống.
    - enabled = false -> User chỉ thấy trắc nghiệm bình thường.
====================================================*/

function syncFillInUI() {

    const category = homeworkData.category;

    // Tính năng này CHỈ áp dụng cho Reading (cả Riêng lẫn Chung)
    if (category !== "reading") {
        fillinToggleSection.style.display = "none";
        fillinConfigSection.style.display = "none";
        return;
    }

    const part = homeworkData.parts[currentPart];
    if (!part.fillIn) part.fillIn = newFillInConfig();

    fillinToggleSection.style.display = "flex";

    btnFillinToggle.classList.toggle("active", part.fillIn.enabled);
    btnFillinToggle.innerHTML = part.fillIn.enabled
        ? "✖️ Tắt Fill in the blanks"
        : "✏️ Fill in the blanks";

    fillinConfigSection.style.display = part.fillIn.enabled ? "block" : "none";

    if (part.fillIn.enabled) {
        renderFillInConfig(part.fillIn);
    }
}

btnFillinToggle.addEventListener("click", function () {
    const part = homeworkData.parts[currentPart];
    if (!part.fillIn) part.fillIn = newFillInConfig();
    part.fillIn.enabled = !part.fillIn.enabled;
    syncFillInUI();
});

function renderFillInConfig(fillIn) {

    if (!Array.isArray(fillIn.answers) || fillIn.answers.length === 0) {
        fillIn.answers = newFillList();
    }

    fillIn.answers = fillIn.answers.map(normalizeFillItem);

    fillinCountLabel.innerText = `${fillIn.answers.length} câu`;
    fillinList.innerHTML = "";

    fillIn.answers.forEach(function (item, qIndex) {

        const row = document.createElement("div");
        row.className = "answer-row fill-row";
        row.innerHTML = `
            <span class="answer-row-label">Chỗ trống ${qIndex + 1}</span>
            <input type="text" class="fill-answer-input" placeholder="Đáp án đúng...">
        `;

        const input = row.querySelector(".fill-answer-input");
        input.value = item.correctText || "";

        input.addEventListener("input", function () {
            item.correctText = input.value;
        });

        fillinList.appendChild(row);
    });
}

btnFillinPlus.addEventListener("click", function () {
    const part = homeworkData.parts[currentPart];
    if (!part.fillIn) part.fillIn = newFillInConfig();
    if (part.fillIn.answers.length >= 20) return;
    part.fillIn.answers.push(newFillItem());
    renderFillInConfig(part.fillIn);
});

btnFillinMinus.addEventListener("click", function () {
    const part = homeworkData.parts[currentPart];
    if (!part.fillIn || part.fillIn.answers.length <= 1) return;
    part.fillIn.answers.pop();
    renderFillInConfig(part.fillIn);
});

/*====================================================
    Hiển thị Part / Next / Back
====================================================*/

function updatePart() {

    partTitle.innerHTML = `Part ${currentPart} / ${TOTAL_PARTS}`;
    progressBar.style.width = (currentPart / TOTAL_PARTS * 100) + "%";

    btnBack.style.display = currentPart === 1 ? "none" : "inline-block";

    if (currentPart === TOTAL_PARTS) {
        btnNext.style.display = "none";
        btnDone.style.display = "inline-block";
    } else {
        btnNext.style.display = "inline-block";
        btnDone.style.display = "none";
    }
}

function refreshPart() {
    updatePart();
    syncModeUI();
}

btnNext.addEventListener("click", function () {
    if (currentPart >= TOTAL_PARTS) return;
    currentPart++;
    refreshPart();
});

btnBack.addEventListener("click", function () {
    if (currentPart <= 1) return;
    currentPart--;
    refreshPart();
});

/*====================================================
    Load bài Edit
====================================================*/

function parseFieldFromDB(raw) {

    if (!raw) return newField();

    if (typeof raw === "string") {
        // Dữ liệu cũ nhất: reading/question/prompt/task là 1 chuỗi url ảnh
        return { file: null, preview: null, url: raw, text: "" };
    }

    if (raw.type === "text") {
        return { file: null, preview: null, url: null, text: raw.content || "" };
    }

    return { file: null, preview: null, url: raw.value || null, text: "" };
}

async function loadHomework() {

    try {

        const doc = await db.collection("homeworks").doc(editID).get();

        if (!doc.exists) {
            alert("Không tìm thấy bài tập.");
            return;
        }

        const data = doc.data();

        homeworkData.name = data.name || "";
        homeworkData.createdAt = data.createdAt || "";
        homeworkData.category = data.category === "listening" ? "listening" : "reading";

        // Dữ liệu tạo trước khi có tính năng Riêng/Chung sẽ không có "mode"
        // -> mặc định coi là "private" (đúng với cấu trúc Question + Reading cũ).
        homeworkData.mode = data.mode === "shared" ? "shared" : "private";

        let hasTextData = false;

        if (homeworkData.category === "listening") {

            for (let i = 1; i <= TOTAL_PARTS; i++) {

                const part = data.parts?.[i] || data.parts?.[String(i)];
                const qType = questionTypeForPart(i);

                homeworkData.parts[i] = newListeningPart(i);

                if (part) {
                    homeworkData.parts[i].audio = { url: part.audio || null, preview: null, uploading: false, mimeType: null };
                    homeworkData.parts[i].prompt = parseFieldFromDB(part.prompt);
                    homeworkData.parts[i].questionType = qType;

                    homeworkData.parts[i].answers = qType === "fill"
                        ? (Array.isArray(part.answers) && part.answers.length > 0
                            ? part.answers.map(normalizeFillItem)
                            : newFillList())
                        : (Array.isArray(part.answers) && part.answers.length > 0
                            ? part.answers.map(normalizeAnswerItem)
                            : newAnswerList());

                    if (part.prompt && typeof part.prompt === "object" && part.prompt.type === "text") {
                        hasTextData = true;
                    }
                }
            }

        } else if (homeworkData.mode === "shared") {

            for (let i = 1; i <= TOTAL_PARTS; i++) {

                const part = data.parts?.[i] || data.parts?.[String(i)];
                homeworkData.parts[i] = newReadingSharedPart();

                if (part) {
                    homeworkData.parts[i].task = parseFieldFromDB(part.task);

                    homeworkData.parts[i].answers = Array.isArray(part.answers) && part.answers.length > 0
                        ? part.answers.map(normalizeAnswerItem)
                        : newAnswerList();

                    homeworkData.parts[i].fillIn = {
                        enabled: !!part.fillIn?.enabled,
                        answers: Array.isArray(part.fillIn?.answers) && part.fillIn.answers.length > 0
                            ? part.fillIn.answers.map(normalizeFillItem)
                            : newFillList()
                    };

                    if (part.task && typeof part.task === "object" && part.task.type === "text") {
                        hasTextData = true;
                    }
                }
            }

        } else {

            for (let i = 1; i <= TOTAL_PARTS; i++) {

                const part = data.parts?.[i] || data.parts?.[String(i)];
                homeworkData.parts[i] = newReadingPrivatePart();

                if (part) {
                    homeworkData.parts[i].question = parseFieldFromDB(part.question);
                    homeworkData.parts[i].reading = parseFieldFromDB(part.reading);

                    homeworkData.parts[i].answers = Array.isArray(part.answers) && part.answers.length > 0
                        ? part.answers.map(normalizeAnswerItem)
                        : newAnswerList();

                    homeworkData.parts[i].fillIn = {
                        enabled: !!part.fillIn?.enabled,
                        answers: Array.isArray(part.fillIn?.answers) && part.fillIn.answers.length > 0
                            ? part.fillIn.answers.map(normalizeFillItem)
                            : newFillList()
                    };

                    if ((part.question && typeof part.question === "object" && part.question.type === "text") ||
                        (part.reading && typeof part.reading === "object" && part.reading.type === "text")) {
                        hasTextData = true;
                    }
                }
            }
        }

        homeworkData.type = data.type === "text" || data.type === "image"
            ? data.type
            : (hasTextData ? "text" : "image");

        if (homeworkName) {
            homeworkName.value = homeworkData.name;
        }

        refreshPart();
        showToast("Đã tải bài tập.");

    } catch (error) {
        console.error(error);
    }
}

/*====================================================
    Upload & Lưu bài
====================================================*/

function base64ToBlob(base64String) {
    const parts = base64String.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const byteString = atob(parts[1]);

    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }

    return new Blob([byteArray], { type: mime });
}

async function uploadBase64Image(base64String) {
    if (!base64String) return null;

    try {
        const blob = base64ToBlob(base64String);
        const url = await uploadImage(blob);
        if (!url) throw new Error("Upload thất bại");
        return url;
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        throw error;
    }
}

// Upload TOÀN BỘ ảnh (question/reading/task/prompt) của TẤT CẢ part đang có
// preview (base64) chưa có url. File nghe (audio) đã được upload NGAY lúc
// chọn file (xem handleAudioFile), nên không cần xử lý lại ở đây.
async function uploadAllPendingImages() {

    const tasks = [];

    if (homeworkData.category === "listening") {

        if (homeworkData.type === "image") {
            for (let i = 1; i <= TOTAL_PARTS; i++) {
                const part = homeworkData.parts[i];
                if (part?.prompt?.preview) {
                    tasks.push(
                        uploadBase64Image(part.prompt.preview).then(url => { part.prompt.url = url; })
                    );
                }
            }
        }

        await Promise.all(tasks);
        return;
    }

    if (homeworkData.type === "text") return;

    if (homeworkData.mode === "shared") {

        for (let i = 1; i <= TOTAL_PARTS; i++) {
            const part = homeworkData.parts[i];
            if (part?.task?.preview) {
                tasks.push(uploadBase64Image(part.task.preview).then(url => { part.task.url = url; }));
            }
        }

        await Promise.all(tasks);
        return;
    }

    for (let i = 1; i <= TOTAL_PARTS; i++) {
        const part = homeworkData.parts[i];

        if (part?.question?.preview) {
            tasks.push(uploadBase64Image(part.question.preview).then(url => { part.question.url = url; }));
        }

        if (part?.reading?.preview) {
            tasks.push(uploadBase64Image(part.reading.preview).then(url => { part.reading.url = url; }));
        }
    }

    await Promise.all(tasks);
}

function buildFieldSaveData(field) {

    if (!field) return null;

    if (homeworkData.type === "text") {
        const content = (field.text || "").trim();
        return content ? { type: "text", content: content } : null;
    }

    return field.url ? { type: "image", value: field.url } : null;
}

function buildPartSaveData(i) {

    const part = homeworkData.parts[i];

    if (homeworkData.category === "listening") {
        return {
            audio: part.audio?.url || null,
            prompt: buildFieldSaveData(part.prompt),
            questionType: part.questionType,
            answers: part.answers || []
        };
    }

    if (homeworkData.mode === "shared") {
        return {
            task: buildFieldSaveData(part.task),
            answers: part.answers || [],
            fillIn: buildFillInSaveData(part.fillIn)
        };
    }

    return {
        question: buildFieldSaveData(part.question),
        reading: buildFieldSaveData(part.reading),
        answers: part.answers || [],
        fillIn: buildFillInSaveData(part.fillIn)
    };
}

// Chuẩn hóa dữ liệu Fill in the blanks trước khi lưu. Nếu Admin không bật
// tính năng này, vẫn lưu enabled:false để phía User biết là KHÔNG hiển thị
// phần điền chỗ trống (chỉ trắc nghiệm thường).
function buildFillInSaveData(fillIn) {
    const enabled = !!fillIn?.enabled;
    return {
        enabled: enabled,
        answers: enabled
            ? (fillIn.answers || []).map(a => ({ correctText: (a.correctText || "").trim() }))
            : []
    };
}

function countMissingAnswers() {

    let missing = 0;

    for (let i = 1; i <= TOTAL_PARTS; i++) {

        const part = homeworkData.parts[i];
        const qType = homeworkData.category === "listening" ? part.questionType : "choice";
        const answers = part.answers || [];

        answers.forEach(function (a) {
            if (qType === "fill") {
                const item = normalizeFillItem(a);
                if (!item.correctText || !item.correctText.trim()) missing++;
            } else {
                const item = normalizeAnswerItem(a);
                if (!item.correct) missing++;
            }
        });

        if (homeworkData.category === "reading" && part.fillIn?.enabled) {
            (part.fillIn.answers || []).forEach(function (a) {
                const item = normalizeFillItem(a);
                if (!item.correctText || !item.correctText.trim()) missing++;
            });
        }
    }

    return missing;
}

function countMissingAudio() {
    if (homeworkData.category !== "listening") return 0;

    let missing = 0;
    for (let i = 1; i <= TOTAL_PARTS; i++) {
        if (!homeworkData.parts[i].audio?.url) missing++;
    }
    return missing;
}

function confirmIncompleteData() {
    const missingAnswers = countMissingAnswers();
    const missingAudio = countMissingAudio();

    if (missingAnswers === 0 && missingAudio === 0) return true;

    let msg = "";
    if (missingAudio > 0) msg += `Còn ${missingAudio} Part chưa có file nghe. `;
    if (missingAnswers > 0) msg += `Còn ${missingAnswers} câu chưa có đáp án đúng.`;

    return confirm(msg + " Vẫn muốn lưu?");
}

//==============================
// Done (Cập nhật - Edit)
//==============================

btnDone.addEventListener("click", async function () {

    if (!isEdit) {
        modal.style.display = "flex";
        modal.classList.add("active");
        homeworkName.focus();
        return;
    }

    if (!confirmIncompleteData()) return;

    btnDone.disabled = true;
    btnDone.innerHTML = "Saving...";

    try {

        await uploadAllPendingImages();

        const saveData = {
            name: homeworkData.name,
            createdAt: homeworkData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            mode: homeworkData.mode,
            category: homeworkData.category,
            type: homeworkData.type,
            parts: {}
        };

        for (let i = 1; i <= TOTAL_PARTS; i++) {
            saveData.parts[i] = buildPartSaveData(i);
        }

        await db.collection("homeworks").doc(editID).update(saveData);

        localStorage.removeItem("edit_homework_id");
        showToast("Đã cập nhật bài tập!");

        setTimeout(function () {
            window.location.href = "History.html";
        }, 1000);

    } catch (error) {
        console.error(error);
        alert("Có lỗi khi cập nhật!");
    } finally {
        btnDone.disabled = false;
        btnDone.innerHTML = "Done";
    }
});

//==============================
// Cancel
//==============================

btnCancel.addEventListener("click", function () {
    modal.classList.remove("active");
    setTimeout(function () {
        modal.style.display = "none";
    }, 300);
});

//==============================
// Save (Tạo mới)
//==============================

btnSave.addEventListener("click", async function () {

    const name = homeworkName.value.trim();
    if (name === "") {
        alert("Vui lòng nhập tên bài tập!");
        return;
    }

    homeworkData.name = name;

    if (!confirmIncompleteData()) return;

    btnSave.disabled = true;
    btnSave.innerHTML = "Đang lưu...";

    try {

        await uploadAllPendingImages();

        const saveData = {
            name: homeworkData.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            mode: homeworkData.mode,
            category: homeworkData.category,
            type: homeworkData.type,
            parts: {}
        };

        for (let i = 1; i <= TOTAL_PARTS; i++) {
            saveData.parts[i] = buildPartSaveData(i);
        }

        await db.collection("homeworks").add(saveData);

        showToast("Lưu bài tập thành công!");
        modal.classList.remove("active");
        setTimeout(() => { modal.style.display = "none"; }, 300);
        homeworkName.value = "";
        setTimeout(() => { window.location.href = "History.html"; }, 1200);

    } catch (error) {
        console.error(error);
        alert("Có lỗi khi lưu bài tập!");
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = "Save";
    }
});
