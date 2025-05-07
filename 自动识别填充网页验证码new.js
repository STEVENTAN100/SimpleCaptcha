// ==UserScript==
// @name         自动识别填充网页验证码new
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  自动识别填写大部分网站的数英验证码
// @author       steventan
// @license      GPL Licence
// @connect      *
// @match        http://*/*
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    var element, input, imgIndex, canvasIndex, inputIndex, captchaType;
    var localRules = [];
    var queryUrl = "http://127.0.0.1:5000/"
    var exist = false;
    var iscors = false;
    var inBlack = false;
    var firstin = true;

    var fisrtUse = GM_getValue("fisrtUse", true);
    if (fisrtUse) {
        GM_setValue("fisrtUse", false);
    }

    //添加菜单
    GM_registerMenuCommand('添加当前页面规则', addRule);
    GM_registerMenuCommand('清除当前页面规则', delRule);
    GM_registerMenuCommand('管理网页黑名单', manageBlackList);
    GM_registerMenuCommand('云码Token（算术验证码专用）', saveToken)
    GM_registerMenuCommand('加入交流/反馈群', getQQGroup);

    GM_setValue("preCode", "");

    function getQQGroup() {
        GM_xmlhttpRequest({
            method: "GET",
            url: queryUrl + "getQQGroup",
            onload: function (response) {
                try {
                    var qqGroup = response.responseText;
                    alert(qqGroup);
                }
                catch (err) {
                    return "群号获取失败";
                }
            }
        });
    }

    function saveToken() {
        var token = prompt(`帮助文档：https://docs.qq.com/doc/DWkhma0dsb1BxdEtU`, "输入Token");
        if (token == null) {
            return;
        }
        alert("Token保存成功");
        GM_setValue("token", token);
    }

    //判断是否为验证码（预设规则）
    function isCode(imageElement) {
        if (!imageElement) return false;
        // Adjusted height check: ignore very tall images or perfect squares (often icons/logos)
        // but allow if height is small (common for captchas)
        if (imageElement.height >= 100 || (imageElement.height > 30 && imageElement.height == imageElement.width)) {
            // console.log("isCode: false due to dimensions", imageElement.src, imageElement.height, imageElement.width);
            return false;
        }
        var attrList = ["id", "title", "alt", "name", "className"]; // Removed "src" check here, it's not reliable for keywords
        var strList = ["code", "Code", "CODE", "captcha", "Captcha", "CAPTCHA", "yzm", "Yzm", "YZM", "check", "Check", "CHECK", "random", "Random", "RANDOM", "veri", "Veri", "VERI", "验证码", "看不清", "换一张", "verify", "Verify", "VERIFY", "validate", "imgcode"];
        for (var i = 0; i < attrList.length; i++) {
            for (var j = 0; j < strList.length; j++) {
                var attrValue = imageElement[attrList[i]];
                if (typeof attrValue === 'string' && attrValue.toLowerCase().indexOf(strList[j].toLowerCase()) != -1) {
                    // console.log("isCode: true due to attribute", attrList[i], attrValue, "matching", strList[j]);
                    return true;
                }
            }
        }
        // Fallback: if src contains "captcha", "verify", "validate", "code" and dimensions are reasonable
        if (imageElement.src) {
            const srcLower = imageElement.src.toLowerCase();
            const srcKeywords = ["captcha", "verify", "validate", "code", "verifyimage", "getcode"];
            for (const keyword of srcKeywords) {
                if (srcLower.includes(keyword) && imageElement.height < 100 && imageElement.width < 300 && imageElement.height > 10 && imageElement.width > 30) {
                    // console.log("isCode: true due to src keyword and dimensions", imageElement.src);
                    return true;
                }
            }
        }
        // console.log("isCode: false by default", imageElement.src);
        return false;
    }

    //判断是否为验证码输入框（预设规则）
    function isInput() {
        var attrList = ["placeholder", "alt", "title", "id", "className", "name"];
        var strList = ["code", "Code", "CODE", "captcha", "Captcha", "CAPTCHA", "yzm", "Yzm", "YZM", "check", "Check", "CHECK", "random", "Random", "RANDOM", "veri", "Veri", "VERI", "验证码", "看不清", "换一张"];
        for (var i = 0; i < attrList.length; i++) {
            for (var j = 0; j < strList.length; j++) {
                // var str = "input." + attrList[i];
                var attr = input[attrList[i]];
                if (attr.indexOf(strList[j]) != -1) {
                    // console.log(attr);
                    return true;
                }
            }
        }
        return false;
    }

    //手动添加规则（操作）
    function addRule() {
        var ruleData = { "url": window.location.href.split("?")[0], "img": "", "input": "", "inputType": "", "type": "", "captchaType": "" };
        //检测鼠标右键点击事件
        topNotice("请在验证码图片上点击鼠标 “右”👉 键");
        document.oncontextmenu = function (e) {
            e = e || window.event;
            e.preventDefault();

            if (e.target.tagName == "IMG" || e.target.tagName == "GIF") {
                var imgList = document.getElementsByTagName('img');
                for (var i = 0; i < imgList.length; i++) {
                    if (imgList[i] == e.target) {
                        var k = i;
                        ruleData.type = "img";
                    }
                }
            }
            else if (e.target.tagName == "CANVAS") {
                var imgList = document.getElementsByTagName('canvas');
                for (var i = 0; i < imgList.length; i++) {
                    if (imgList[i] == e.target) {
                        var k = i;
                        ruleData.type = "canvas";
                    }
                }
            }
            if (k == null) {
                topNotice("选择有误，请重新点击验证码图片");
                return;
            }
            ruleData.img = k;
            topNotice("请在验证码输入框上点击鼠标 “左”👈 键");
            document.onclick = function (e) {
                e = e || window.event;
                e.preventDefault();
                var inputList = document.getElementsByTagName('input');
                var textareaList = document.getElementsByTagName('textarea');
                // console.log(inputList);
                if (e.target.tagName == "INPUT") {
                    ruleData.inputType = "input";
                    for (var i = 0; i < inputList.length; i++) {
                        if (inputList[i] == e.target) {
                            if (inputList[0] && (inputList[0].id == "_w_simile" || inputList[0].id == "black_node")) {
                                var k = i - 1;
                            }
                            else {
                                var k = i;
                            }
                        }
                    }
                }
                else if (e.target.tagName == "TEXTAREA") {
                    ruleData.inputType = "textarea";
                    for (var i = 0; i < textareaList.length; i++) {
                        if (textareaList[i] == e.target) {
                            var k = i;
                        }
                    }
                }
                if (k == null) {
                    topNotice("选择有误，请重新点击验证码输入框");
                    return;
                }
                ruleData.input = k;
                var r = confirm("选择验证码类型\n\n数/英验证码请点击“确定”，算术验证码请点击“取消”");
                if (r == true) {
                    ruleData.captchaType = "general";
                }
                else {
                    ruleData.captchaType = "math";
                }
                addR(ruleData).then((res) => {
                    if (res.status == 200) {
                        topNotice("添加规则成功");
                        document.oncontextmenu = null;
                        document.onclick = null;
                        start();
                    }
                    else {
                        topNotice("Error，添加规则失败");
                        document.oncontextmenu = null;
                        document.onclick = null;
                    }
                });
            }
        }
    }

    //手动添加规则（请求）
    function addR(ruleData) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: queryUrl + "updateRule",
                data: JSON.stringify(ruleData),
                headers: {
                    "Content-Type": "application/json"
                },
                onload: function (response) {
                    return resolve(response);
                }
            });
        });
    }

    //删除当前页面规则
    function delRule() {
        var ruleData = { "url": window.location.href.split("?")[0] }
        delR(ruleData).then((res) => {
            if (res.status == 200)
                topNotice("删除规则成功");
            else
                topNotice("Error，删除规则失败");
        });
    }

    //删除规则（请求）
    function delR(ruleData) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: queryUrl + "deleteRule",
                data: JSON.stringify(ruleData),
                headers: {
                    "Content-Type": "application/json"
                },
                onload: function (response) {
                    return resolve(response);
                }
            });
        });
    }

    //按已存规则填充
    function codeByRule() {
        // ***** ADD THIS GUARD CLAUSE *****
        if (!element || typeof element.src === 'undefined') {
            // console.error("codeByRule: 'element' is undefined or 'element.src' is undefined. Aborting.");
            return;
        }
        var code = "";
        var src = element.src; // 'element' should be set by start()
        let firstTimeInThisCall = true; // Replaces the global 'firstin' for this function's scope
        // Helper to process base64
        const processBase64 = (b64Code) => {
            GM_setValue("tempCode", b64Code);
            if (GM_getValue("tempCode") != GM_getValue("preCode") || firstTimeInThisCall) {
                if (firstTimeInThisCall) GM_setValue("preCode", ""); // Force re-recognition if it's the first attempt in this cycle
                GM_setValue("preCode", GM_getValue("tempCode"));
                firstTimeInThisCall = false;
                p1(b64Code).then((ans) => { // p1 is for rule-based
                    if (ans != "") writeIn1(ans); // writeIn1 is for rule-based
                    // else if (firstTimeInThisCall) codeByRule(); // Avoid deep recursion
                });
            }
        };

        if (src.startsWith('data:image')) {
            code = src.split("base64,")[1];
            processBase64(code);
        } else if (src.startsWith('blob:')) {
            // Convert blob URL to base64
            fetch(src).then(res => res.blob()).then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    code = reader.result.split("base64,")[1];
                    processBase64(code);
                };
                reader.onerror = () => console.error("codeByRule: FileReader error for blob", src);
                reader.readAsDataURL(blob);
            }).catch(err => console.error("codeByRule: Fetch error for blob", src, err));
        } else { // Not data or blob, attempt canvas (should only be for same-origin if p2 worked for CORS)
            // If iscors was true, p2() should have already converted element.src to a data URI.
            // This path should ideally only be hit if iscors was false.
            if (isCORS(element)) { // Double check, though p2 should have handled.
                console.warn("codeByRule: Reached canvas path for a CORS image, p2 might not have updated src yet or failed. Attempting p2 again or image might be tainted.");
                // Fallback to p2 if needed, or rely on p2 having already run from start()
                p2().then(() => { // p2 updates element.src
                    if (element.src.startsWith('data:image')) {
                        code = element.src.split("base64,")[1];
                        processBase64(code);
                    } else {
                        console.error("codeByRule: p2 ran but src not data URI", element.src);
                    }
                }).catch(e => console.error("codeByRule: p2 fallback failed", e));
                return;
            }
            // Same-origin, use canvas
            var img = element;
            const tryCanvas = () => {
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    // console.log("codeByRule: Image not loaded or zero dimensions, skipping canvas attempt for now.", img.src);
                    // Potentially set up onload if not already loaded, but be careful with loops
                    if (!img.dataset.onloadAttached) { // Prevent multiple onload attachments
                        img.onload = () => {
                            img.dataset.onloadAttached = true;
                            codeByRule(); // Retry after load
                        };
                        img.onerror = () => console.error("codeByRule: image load error for canvas", img.src);
                    }
                    return;
                }
                var canvas = document.createElement("canvas");
                var ctx = canvas.getContext("2d");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                try {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    code = canvas.toDataURL("image/png").split("base64,")[1];
                    processBase64(code);
                } catch (err_canvas) {
                    console.error("codeByRule: Canvas toDataURL error", img.src, err_canvas);
                    // This can still be SecurityError if image became tainted unexpectedly
                }
            };
            if (img.complete && img.naturalHeight !== 0) {
                tryCanvas();
            } else {
                if (!img.dataset.onloadAttached) {
                    img.dataset.onloadAttached = true;
                    img.onload = tryCanvas; // Let onload trigger the canvas attempt
                    img.onerror = () => { console.error("codeByRule: Image failed to load for canvas path", img.src); };
                }
            }
        }
    }

    function canvasRule() {
        setTimeout(function () {
            // console.log(element.toDataURL("image/png"));
            try {
                var code = element.toDataURL("image/png").split("base64,")[1];
                GM_setValue("tempCode", code);
                if (GM_getValue("tempCode") != GM_getValue("preCode")) {
                    // console.log("preCode:" + GM_getValue("preCode"))
                    // console.log("tempCode:" + GM_getValue("tempCode"))
                    GM_setValue("preCode", GM_getValue("tempCode"));
                    p1(code).then((ans) => {
                        writeIn1(ans);
                    });
                }
            }
            catch (err) {
                canvasRule();
            }
        }, 100);
    }

    //寻找网页中的验证码
    function findCode(startIndex) {
        var codeList = document.getElementsByTagName('img');
        // console.log("findCode called with startIndex:", startIndex, "found", codeList.length, "images");
        for (var i = startIndex; i < codeList.length; i++) {
            let currentElement = codeList[i];
            let currentImgIndex = i; // For passing to p()
            // Skip if image has no src or is not visible/too small
            if (!currentElement.src || currentElement.offsetParent === null || currentElement.clientWidth < 10 || currentElement.clientHeight < 10) {
                continue;
            }
            if (isCode(currentElement)) { // Pass currentElement to isCode
                // console.log("findCode: Potential captcha found", currentElement.src);
                if (currentElement.src.indexOf('data:image') === 0) { // Starts with 'data:image'
                    // console.log("findCode: Processing Base64 image", currentElement.src);
                    let base64Code = currentElement.src.split("base64,")[1];
                    GM_setValue("tempCode", base64Code);
                    if (GM_getValue("tempCode") !== GM_getValue("preCode")) {
                        GM_setValue("preCode", GM_getValue("tempCode"));
                        p(base64Code, currentImgIndex).then((ans) => {
                            if (ans !== "") writeIn(ans);
                        });
                    }
                    return; // Processed one image, exit
                } else {
                    // Not a data:image, check CORS
                    if (isCORS(currentElement)) {
                        console.log("findCode: CORS image detected, using GM_xmlhttpRequest for:", currentElement.src);
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: currentElement.src,
                            responseType: "blob",
                            headers: { // Some sites might need a referer or other headers
                                "Referer": window.location.href
                            },
                            onload: function (response) {
                                if ((response.status === 200 || response.status === 0) && response.response) {
                                    let blob = response.response;
                                    let reader = new FileReader();
                                    reader.onloadend = function () {
                                        let dataUrl = reader.result;
                                        let base64Code = dataUrl.split("base64,")[1];
                                        if (base64Code) {
                                            GM_setValue("tempCode", base64Code);
                                            if (GM_getValue("tempCode") !== GM_getValue("preCode")) {
                                                GM_setValue("preCode", GM_getValue("tempCode"));
                                                p(base64Code, currentImgIndex).then((ans) => {
                                                    if (ans !== "") writeIn(ans);
                                                });
                                            }
                                        } else {
                                            console.error("findCode: Failed to get base64 from blob for CORS image:", currentElement.src);
                                        }
                                    };
                                    reader.onerror = function () {
                                        console.error("findCode: FileReader error for CORS image", currentElement.src);
                                    };
                                    reader.readAsDataURL(blob);
                                } else {
                                    console.error("findCode: GM_xmlhttpRequest status error or no response", response.status, "for", currentElement.src);
                                }
                            },
                            onerror: function (responseDetails) {
                                console.error("findCode: GM_xmlhttpRequest network error for CORS image", currentElement.src, responseDetails);
                            },
                            ontimeout: function () {
                                console.error("findCode: GM_xmlhttpRequest timeout for CORS image", currentElement.src);
                            }
                        });
                        return; // Initiated async processing for one image, exit
                    } else {
                        // Same-origin image, use canvas
                        console.log("findCode: Same-origin image detected, using canvas for:", currentElement.src);
                        var imgToProcess = currentElement;
                        const processSameOriginImage = () => {
                            var canvas = document.createElement("canvas");
                            var ctx = canvas.getContext("2d");

                            // Use naturalWidth/Height for actual dimensions if available and non-zero
                            canvas.width = imgToProcess.naturalWidth || imgToProcess.width;
                            canvas.height = imgToProcess.naturalHeight || imgToProcess.height;
                            if (canvas.width === 0 || canvas.height === 0) {
                                console.warn("findCode: Image dimensions are zero for (same-origin):", imgToProcess.src);
                                return; // Skip this image
                            }
                            try {
                                ctx.drawImage(imgToProcess, 0, 0, canvas.width, canvas.height);
                                let base64Code = canvas.toDataURL("image/png").split("base64,")[1];
                                GM_setValue("tempCode", base64Code);
                                if (GM_getValue("tempCode") !== GM_getValue("preCode")) {
                                    GM_setValue("preCode", GM_getValue("tempCode"));
                                    p(base64Code, currentImgIndex).then((ans) => {
                                        if (ans !== "") writeIn(ans);
                                    });
                                }
                            } catch (e) {
                                console.error("findCode: Canvas toDataURL error for same-origin image:", imgToProcess.src, e);
                                // This shouldn't be a SecurityError if truly same-origin and not tainted
                            }
                        };
                        if (imgToProcess.complete && imgToProcess.naturalHeight !== 0) {
                            processSameOriginImage();
                        } else {
                            imgToProcess.onload = processSameOriginImage;
                            imgToProcess.onerror = function () {
                                console.error("findCode: Image failed to load (same-origin):", imgToProcess.src);
                            };
                            // If src is already set and it's a broken link, onload might not fire.
                            // Setting src again *can* sometimes re-trigger loading for certain cases,
                            // but it's generally not reliable if it's already errored.
                            // If it's a relative path, ensure it's correct.
                        }
                        return; // Initiated processing for one image, exit
                    }
                }
                // If an image was identified and processing was started (and function returned),
                // this break is not strictly necessary but reinforces the "process one" idea.
                // break; // Exiting loop after finding and initiating processing for one image
            }
        }
        // console.log("findCode: Finished scan, no suitable image processed in this call.");
    }

    //寻找网页中的验证码输入框
    function findInput() {
        var inputList = document.getElementsByTagName('input');
        // console.log(inputList);
        for (var i = 0; i < inputList.length; i++) {
            input = inputList[i];
            if (isInput()) {
                return true;
            }
        }
    }

    //将识别结果写入验证码输入框（预设规则）
    function writeIn(ans) {
        if (findInput()) {
            ans = ans.replace(/\s+/g, "");
            input.value = ans;
            if (typeof (InputEvent) !== "undefined") {
                input.value = ans;
                input.dispatchEvent(new InputEvent('input'));
                var eventList = ['input', 'change', 'focus', 'keypress', 'keyup', 'keydown', 'select'];
                for (var i = 0; i < eventList.length; i++) {
                    fire(input, eventList[i]);
                }
                input.value = ans;
            }
            else if (KeyboardEvent) {
                input.dispatchEvent(new KeyboardEvent("input"));
            }
        }
    }

    //识别验证码（预设规则）
    function p(code, i) {
        return new Promise((resolve, reject) => {
            const datas = {
                "ImageBase64": String(code),
            }
            GM_xmlhttpRequest({
                method: "POST",
                url: queryUrl + "identify_GeneralCAPTCHA",
                data: JSON.stringify(datas),
                headers: {
                    "Content-Type": "application/json",
                },
                responseType: "json",
                onload: function (response) {
                    // console.log(response);
                    if (response.status == 200) {
                        if (response.responseText.indexOf("触发限流策略") != -1)
                            topNotice(response.response["msg"]);
                        try {
                            var result = response.response["result"];
                            console.log("识别结果：" + result);
                            return resolve(result);
                        }
                        catch (e) {
                            if (response.responseText.indexOf("接口请求频率过高") != -1)
                                // console.log(response.responseText)
                                topNotice(response.responseText);
                        }
                    }
                    else {
                        try {
                            if (response.response["result"] == null)
                                findCode(i + 1);
                            else
                                console.log("识别失败");
                        }
                        catch (err) {
                            console.log("识别失败");
                        }
                    }
                }
            });
        });
    }

    //识别验证码（自定义规则）
    function p1(code) {
        if (captchaType == "general" || captchaType == null) {
            return new Promise((resolve, reject) => {
                const datas = {
                    "ImageBase64": String(code),
                }
                GM_xmlhttpRequest({
                    method: "POST",
                    url: queryUrl + "identify_GeneralCAPTCHA",
                    data: JSON.stringify(datas),
                    headers: {
                        "Content-Type": "application/json",
                    },
                    responseType: "json",
                    onload: function (response) {
                        // console.log(response);
                        if (response.status == 200) {
                            if (response.responseText.indexOf("触发限流策略") != -1)
                                topNotice(response.response["msg"]);
                            try {
                                var result = response.response["result"];
                                console.log("识别结果：" + result);
                                return resolve(result);
                            }
                            catch (e) {
                                if (response.responseText.indexOf("接口请求频率过高") != -1)
                                    // console.log(response.responseText)
                                    topNotice(response.responseText);
                            }
                        }
                        else {
                            console.log("识别失败");
                        }
                    }
                });
            });
        }
        else if (captchaType == "math") {
            if (GM_getValue("token") == undefined) {
                topNotice("识别算术验证码请先填写云码Token");
                return;
            }
            var token = GM_getValue("token").replace(/\+/g, '%2B');
            const datas = {
                "image": String(code),
                "type": "50100",
                "token": token,
                "developer_tag": "41acabfb0d980a24e6022e89f9c1bfa4"
            }
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://www.jfbym.com/api/YmServer/customApi",
                    data: JSON.stringify(datas),
                    headers: {
                        "Content-Type": "application/json",
                    },
                    responseType: "json",
                    onload: function (response) {
                        // console.log(response);
                        if (response.response["msg"] == "识别成功") {
                            try {
                                var result = response.response["data"]["data"];
                                console.log("识别结果：" + result);
                                return resolve(result);
                            }
                            catch (e) {
                                topNotice(response.response["msg"]);
                            }
                        }
                        else if (response.response["msg"] == "余额不足") {
                            topNotice("云码积分不足，请自行充值");
                        }
                        else {
                            topNotice("请检查Token是否正确");
                        }
                    }
                });
            });
        }
    }

    //判断是否跨域
    function isCORS(imgElement) {
        if (!imgElement || !imgElement.src) return false;
        // If src is a data URI or blob URI, it's effectively same-origin for canvas purposes
        if (imgElement.src.startsWith('data:') || imgElement.src.startsWith('blob:')) {
            return false;
        }
        try {
            // Check if src is a full URL (http/https)
            if (imgElement.src.startsWith('http://') || imgElement.src.startsWith('https://')) {
                const imgSrcUrl = new URL(imgElement.src); // Check if valid URL
                if (imgSrcUrl.hostname !== window.location.hostname) {
                    // console.log("isCORS: Cross-origin detected - img host:", imgSrcUrl.hostname, "page host:", window.location.hostname);
                    return true;
                }
            }
            return false; // Same hostname or relative path
        } catch (err) { // Error constructing URL (e.g. src is "VerifyImage?update=...")
            // Relative paths are same-origin.
            // console.warn("isCORS: Assuming same-origin due to error or relative path", imgElement.src, err);
            return false;
        }
    }

    //将url转换为base64（解决跨域问题）
    function p2() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: element.src,
                method: "GET",
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'path': window.location.href },
                responseType: "blob",
                onload: function (response) {
                    // console.log(response);
                    let blob = response.response;
                    let reader = new FileReader();
                    reader.onloadend = (e) => {
                        let data = e.target.result;
                        element.src = data;
                        return resolve(data);
                    }
                    reader.readAsDataURL(blob);
                }
            });
        });
    }

    //此段逻辑借鉴Crab大佬的代码，十分感谢
    function fire(element, eventName) {
        var event = document.createEvent("HTMLEvents");
        event.initEvent(eventName, true, true);
        element.dispatchEvent(event);
    }
    function FireForReact(element, eventName) {
        try {
            let env = new Event(eventName);
            element.dispatchEvent(env);
            var funName = Object.keys(element).find(p => Object.keys(element[p]).find(f => f.toLowerCase().endsWith(eventName)));
            if (funName != undefined) {
                element[funName].onChange(env)
            }
        }
        catch (e) { }
    }

    //将识别结果写入验证码输入框（自定义规则）
    function writeIn1(ans) {
        ans = ans.replace(/\s+/g, "");
        if (input.tagName == "TEXTAREA") {
            input.innerHTML = ans;
        }
        else {
            input.value = ans;
            if (typeof (InputEvent) !== "undefined") {
                input.value = ans;
                input.dispatchEvent(new InputEvent('input'));
                var eventList = ['input', 'change', 'focus', 'keypress', 'keyup', 'keydown', 'select'];
                for (var i = 0; i < eventList.length; i++) {
                    fire(input, eventList[i]);
                }
                FireForReact(input, 'change');
                input.value = ans;
            }
            else if (KeyboardEvent) {
                input.dispatchEvent(new KeyboardEvent("input"));
            }
        }
    }

    //判断当前页面是否存在规则，返回布尔值
    function compareUrl() {
        return new Promise((resolve, reject) => {
            var datas = { "url": window.location.href };
            GM_xmlhttpRequest({
                method: "POST",
                url: queryUrl + "queryRule",
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(datas),
                onload: function (response) {
                    // console.log(response);
                    try {
                        localRules = JSON.parse(response.responseText);
                    }
                    catch (err) {
                        localRules = [];
                    }
                    if (localRules.length == 0)
                        return resolve(false);
                    return resolve(true);
                }
            });
        });
    }

    //开始识别
    function start() {
        compareUrl().then((isExist) => {
            if (isExist) {
                exist = true;
                console.log("【自动识别填充验证码】已存在该网站规则");
                if (localRules["type"] == "img") {
                    captchaType = localRules["captchaType"];
                    imgIndex = localRules["img"];
                    inputIndex = localRules["input"];
                    element = document.getElementsByTagName('img')[imgIndex];
                    // console.log(element.src);
                    if (localRules["inputType"] == "textarea") {
                        input = document.getElementsByTagName('textarea')[inputIndex];
                    }
                    else {
                        input = document.getElementsByTagName('input')[inputIndex];
                        var inputList = document.getElementsByTagName('input');
                        // console.log(inputList);
                        if (inputList[0] && (inputList[0].id == "_w_simile" || inputList[0].id == "black_node")) {
                            inputIndex = parseInt(inputIndex) + 1;
                            input = inputList[inputIndex];
                        }
                    }
                    // console.log(input);
                    if (element && input) {
                        iscors = isCORS(element);
                        // console.log(input);
                        // console.log(element);
                        if (iscors) {
                            p2().then(() => {
                                // console.log(data);
                                codeByRule();
                            });
                        }
                        else {
                            codeByRule();
                        }
                    }
                    else
                        pageChange();
                }
                else if (localRules["type"] == "canvas") {
                    captchaType = localRules["captchaType"];
                    canvasIndex = localRules["img"];
                    inputIndex = localRules["input"];
                    element = document.getElementsByTagName('canvas')[canvasIndex];
                    if (localRules["inputType"] == "textarea") {
                        input = document.getElementsByTagName('textarea')[inputIndex];
                    }
                    else {
                        input = document.getElementsByTagName('input')[inputIndex];
                        var inputList = document.getElementsByTagName('input');
                        // console.log(inputList);
                        if (inputList[0] && (inputList[0].id == "_w_simile" || inputList[0].id == "black_node")) {
                            inputIndex = parseInt(inputIndex) + 1;
                            input = inputList[inputIndex];
                        }
                    }
                    iscors = isCORS(element);
                    if (iscors) {
                        p2().then(() => {
                            // console.log(data);
                            canvasRule();
                        });
                    }
                    else {
                        canvasRule();
                    }
                }
            }
            else {
                console.log("【自动识别填充验证码】不存在该网站规则，正在根据预设规则自动识别...");
                findCode(0);
            }
        });
    }

    //页面变化执行函数
    function pageChange() {
        if (exist) {
            if (localRules["type"] == "img" || localRules["type"] == null) {
                element = document.getElementsByTagName('img')[imgIndex];
                if (localRules["inputType"] == "textarea") {
                    input = document.getElementsByTagName('textarea')[inputIndex];
                }
                else {
                    input = document.getElementsByTagName('input')[inputIndex];
                    var inputList = document.getElementsByTagName('input');
                    if (inputList[0] && (inputList[0].id == "_w_simile" || inputList[0].id == "black_node")) {
                        input = inputList[inputIndex];
                    }
                }
                // console.log(element);
                // console.log(input);
                // ***** CRITICAL CHECK *****
                if (!element || !input) { // If element or input could not be re-acquired or is invalid
                    // console.warn("pageChange: Element or input from rule not found or no longer in DOM. Rule might be stale.");
                    // Do not proceed to codeByRule or canvasRule if essential elements are missing.
                    return;
                }
                iscors = isCORS(element);
                if (iscors) {
                    p2().then(() => {
                        // console.log(data);
                        codeByRule();
                    });
                }
                else {
                    codeByRule();
                }
            }
            else if (localRules["type"] == "canvas") {
                element = document.getElementsByTagName('canvas')[canvasIndex];
                if (localRules["inputType"] == "textarea") {
                    input = document.getElementsByTagName('textarea')[inputIndex];
                }
                else {
                    input = document.getElementsByTagName('input')[inputIndex];
                    var inputList = document.getElementsByTagName('input');
                    if (inputList[0] && (inputList[0].id == "_w_simile" || inputList[0].id == "black_node")) {
                        input = inputList[inputIndex];
                    }
                }
                // console.log(element);
                // console.log(input);
                iscors = isCORS(element);
                if (iscors) {
                    p2().then(() => {
                        // console.log(data);
                        canvasRule();
                    });
                }
                else {
                    canvasRule();
                }
            }
        }
        else {
            findCode(0);
        }
    }

    function topNotice(msg) {
        var div = document.createElement('div');
        div.id = 'topNotice';
        div.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 5%; z-index: 9999999999; background: rgba(117,140,148,1); display: flex; justify-content: center; align-items: center; color: #fff; font-family: "Microsoft YaHei"; text-align: center;';
        div.innerHTML = msg;
        div.style.fontSize = 'medium';
        document.body.appendChild(div);
        setTimeout(function () {
            document.body.removeChild(document.getElementById('topNotice'));
        }, 3500);
    }

    function manageBlackList() {
        var blackList = GM_getValue("blackList", []);
        var div = document.createElement("div");
        div.style.cssText = 'width: 700px; height: 350px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; border: 1px solid black; z-index: 9999999999; text-align: center; padding-top: 20px; padding-bottom: 20px; padding-left: 20px; padding-right: 20px; box-shadow: 0px 0px 10px 0px rgba(0,0,0,0.75); border-radius: 10px; overflow: auto;';
        div.innerHTML = "<h3 style='margin-bottom: 12px; font-weight: bold; font-size: 18px;'>黑名单</h3><button style='position: absolute; top: 10px; left: 10px; width: 50px; height: 30px; line-height: 30px; text-align: center; font-size: 13px; margin: 10px' id='add'>添加</button><table id='blackList' style='width:100%; border-collapse:collapse; border: 1px solid black;'><thead style='background-color: #f5f5f5;'><tr><th style='width: 80%; text-align: center; padding: 5px;'>字符串</th><th style='width: 20%; text-align: center; padding: 5px;'>操作</th></tr></thead><tbody></tbody></table><button style='position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; line-height: 30px; text-align: center; font-size: 18px; font-weight: bold; color: #333; background-color: transparent; border: none; outline: none; cursor: pointer;' id='close'>×</button>";
        document.body.insertBefore(div, document.body.firstChild);
        var table = document.getElementById("blackList").getElementsByTagName('tbody')[0];
        for (var i = 0; i < blackList.length; i++) {
            var row = table.insertRow(i);
            row.insertCell(0).innerHTML = "<div style='white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>" + blackList[i] + "</div>";
            var removeBtn = document.createElement("button");
            removeBtn.className = "remove";
            removeBtn.style.cssText = 'background-color: transparent; color: blue; border: none; padding: 5px; font-size: 14px; border-radius: 5px;';
            removeBtn.innerText = "移除";
            row.insertCell(1).appendChild(removeBtn);
        }
        var close = document.getElementById("close");
        close.onclick = function () {
            div.remove();
        }
        var add = document.getElementById("add");
        add.onclick = function () {
            var zz = prompt("请输入一个字符串，任何URL中包含该字符串的网页都将被加入黑名单");
            if (zz == null) return;
            var blackList = GM_getValue("blackList", []);
            if (blackList.indexOf(zz) == -1) {
                blackList.push(zz);
                GM_setValue("blackList", blackList);
                var row = table.insertRow(table.rows.length);
                row.insertCell(0).innerHTML = "<div style='white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>" + zz + "</div>";
                var removeBtn = document.createElement("button");
                removeBtn.className = "remove";
                removeBtn.style.cssText = "background-color: transparent; color: blue; border: none; padding: 5px; font-size: 14px; border-radius: 5px; cursor: pointer; ";
                removeBtn.innerText = "移除";
                row.insertCell(1).appendChild(removeBtn);
                removeBtn.onclick = function () {
                    var index = this.parentNode.parentNode.rowIndex - 1;
                    blackList.splice(index, 1);
                    GM_setValue("blackList", blackList);
                    this.parentNode.parentNode.remove();
                }
                topNotice("添加黑名单成功，刷新页面生效")
            }
            else {
                topNotice("该网页已在黑名单中");
            }
        }
        var remove = document.getElementsByClassName("remove");
        for (var i = 0; i < remove.length; i++) {
            remove[i].onclick = function () {
                var index = this.parentNode.parentNode.rowIndex - 1;
                blackList.splice(index, 1);
                GM_setValue("blackList", blackList);
                this.parentNode.parentNode.remove();
                topNotice("移除黑名单成功，刷新页面生效");
            }
        }
    }

    console.log("【自动识别填充验证码】正在运行...");

    var url = window.location.href;
    var blackList = GM_getValue("blackList", []);
    var inBlack = blackList.some(function (blackItem) {
        return url.includes(blackItem);
    });
    if (inBlack) {
        console.log("【自动识别填充验证码】当前页面在黑名单中");
        return;
    } else {
        start();
    }

    var imgSrc = "";
    //监听页面变化
    setTimeout(function () {
        const targetNode = document.body;
        const config = { attributes: true, childList: true, subtree: true };
        const callback = function () {
            if (inBlack) return;
            try {
                if (iscors) {
                    if (element == undefined) {
                        pageChange();
                    }
                    if (element.src != imgSrc) {
                        console.log("【自动识别填充验证码】页面/验证码已更新，正在识别...");
                        imgSrc = element.src;
                        pageChange();
                    }
                }
                else {
                    console.log("【自动识别填充验证码】页面/验证码已更新，正在识别...");
                    pageChange();
                }
            }
            catch (err) {
                return;
                // pageChange();
            }
        }
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    }, 1000);

    //监听canvas变化
    setTimeout(function () {
        if (inBlack) return;
        try {
            if (element.tagName != "CANVAS") return;
        }
        catch (err) {
            return;
        }
        var canvasData1 = element.toDataURL();
        setInterval(function () {
            var canvasData2 = element.toDataURL();
            if (canvasData1 != canvasData2) {
                console.log("【自动识别填充验证码】页面/验证码已更新，正在识别...");
                canvasData1 = canvasData2;
                pageChange();
            }
        }, 0);
    }, 1000);

    //监听url变化
    setTimeout(function () {
        if (inBlack) return;
        var tempUrl = window.location.href;
        setInterval(function () {
            if (tempUrl != window.location.href) {
                console.log("【自动识别填充验证码】页面/验证码已更新，正在识别...");
                tempUrl = window.location.href;
                start();
            }
        });
    }, 500)
})();