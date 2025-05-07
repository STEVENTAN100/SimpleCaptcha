import base64
from io import BytesIO
# from PIL import Image # ddddocr可以直接处理bytes，Pillow的Image对象不是必需的
from ddddocr import DdddOcr
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

# --- 配置 ---
RULES_FILE = "rules.json"  # 规则存储文件
QQ_GROUP_INFO = "QQ交流/反馈群: 123456789 (请替换为真实群号)" # 自定义QQ群信息

# --- 初始化 ---
app = Flask(__name__)
CORS(app)  # 启用 CORS，允许所有源
ocr = DdddOcr(show_ad=False) # 初始化 ddddocr，禁止广告输出

rules_data = {}

def load_rules():
    """从文件加载规则"""
    global rules_data
    if os.path.exists(RULES_FILE):
        try:
            with open(RULES_FILE, 'r', encoding='utf-8') as f:
                rules_data = json.load(f)
        except json.JSONDecodeError:
            print(f"警告: {RULES_FILE} 文件内容不是有效的JSON格式，将使用空规则集。")
            rules_data = {}
        except Exception as e:
            print(f"加载规则文件时出错: {e}")
            rules_data = {}
    else:
        rules_data = {}
    print(f"已加载 {len(rules_data)} 条规则从 {RULES_FILE}")

def save_rules():
    """保存规则到文件"""
    try:
        with open(RULES_FILE, 'w', encoding='utf-8') as f:
            json.dump(rules_data, f, indent=4, ensure_ascii=False)
        # print(f"规则已保存到 {RULES_FILE}")
    except Exception as e:
        print(f"保存规则文件时出错: {e}")

# 应用启动时加载规则
load_rules()

# --- 端点实现 ---

@app.route('/identify_GeneralCAPTCHA', methods=['POST'])
def general_captcha():
    try:
        data = request.json
        if 'ImageBase64' not in data:
            return jsonify({'error': 'Missing ImageBase64 in request', 'msg': '请求参数错误: 缺少 ImageBase64'}), 400

        image_data_base64 = data['ImageBase64']

        # 去除 Base64 编码的前缀 (例如, 'data:image/png;base64,')
        if ',' in image_data_base64:
            image_data_base64 = image_data_base64.split(',', 1)[1]

        image_bytes = base64.b64decode(image_data_base64)
        
        # 使用 ddddocr 识别验证码 (ddddocr 可以直接处理字节)
        result = ocr.classification(image_bytes)

        print(f"验证码识别请求: 结果 - {result}")
        return jsonify({'result': result, 'msg': '识别成功'})
    except base64.binascii.Error:
        return jsonify({'error': 'Invalid Base64 data', 'msg': 'Base64解码失败'}), 400
    except KeyError:
        # This case should be caught by the initial check, but as a fallback.
        return jsonify({'error': 'Missing ImageBase64 in request data', 'msg': '请求参数错误'}), 400
    except Exception as e:
        print(f"识别验证码时出错: {e}")
        return jsonify({'error': str(e), 'msg': '识别失败: 服务器内部错误'}), 500

@app.route('/updateRule', methods=['POST'])
def update_rule():
    try:
        rule_data = request.json
        # 脚本发送的 ruleData.url 是 window.location.href.split("?")[0]
        url_key = rule_data.get("url") 
        
        if not url_key:
            return jsonify({"error": "Missing 'url' in rule data", "msg": "规则数据缺少URL"}), 400

        # 确保 url_key 是剥离了查询参数和哈希的基础URL
        url_key = url_key.split("?")[0].split("#")[0]

        rules_data[url_key] = rule_data
        save_rules()
        print(f"规则已更新/添加: {url_key}")
        return jsonify({"message": "Rule updated successfully", "msg": "规则更新成功"}), 200
    except Exception as e:
        print(f"更新规则时出错: {e}")
        return jsonify({"error": str(e), "msg": "规则更新失败: 服务器内部错误"}), 500

@app.route('/deleteRule', methods=['POST'])
def delete_rule():
    try:
        data = request.json
        # 脚本发送的 ruleData.url 是 window.location.href.split("?")[0]
        url_key = data.get("url")
        if not url_key:
            return jsonify({"error": "Missing 'url' in request", "msg": "请求缺少URL"}), 400
        
        url_key = url_key.split("?")[0].split("#")[0]

        if url_key in rules_data:
            del rules_data[url_key]
            save_rules()
            print(f"规则已删除: {url_key}")
            return jsonify({"message": "Rule deleted successfully", "msg": "规则删除成功"}), 200
        else:
            print(f"尝试删除不存在的规则: {url_key}")
            return jsonify({"message": "Rule not found", "msg": "未找到要删除的规则"}), 404 # 或者返回200，脚本似乎不区分
    except Exception as e:
        print(f"删除规则时出错: {e}")
        return jsonify({"error": str(e), "msg": "规则删除失败: 服务器内部错误"}), 500

@app.route('/queryRule', methods=['POST'])
def query_rule():
    try:
        data = request.json
        # 脚本发送的 datas.url 是 window.location.href (可能包含查询参数)
        current_url_full = data.get("url")
        if not current_url_full:
            # 脚本期望在解析失败或无数据时 localRules 为空数组
            return jsonify([]), 200 

        # 将查询的URL也处理成与存储键一致的格式
        url_key_to_query = current_url_full.split("?")[0].split("#")[0]
        
        rule = rules_data.get(url_key_to_query)
        
        if rule:
            print(f"查询到规则: {url_key_to_query}")
            return jsonify(rule), 200  # 返回规则对象
        else:
            print(f"未查询到规则: {url_key_to_query}")
            return jsonify([]), 200   # 返回空列表的JSON表示 "[]"
    except Exception as e:
        print(f"查询规则时出错: {e}")
        # 发生错误时也返回空列表，以符合脚本的错误处理逻辑
        return jsonify([]), 200 # 或者返回 500，但脚本的 try-catch 会将其视为空规则

@app.route('/getQQGroup', methods=['GET'])
def get_qq_group():
    # 脚本直接 alert(response.responseText)，所以返回纯文本
    print("QQ群号请求")
    return QQ_GROUP_INFO, 200, {'Content-Type': 'text/plain; charset=utf-8'}

# --- 运行 Flask 应用 ---
if __name__ == '__main__':
    # 确保在运行前加载一次规则
    if not rules_data and os.path.exists(RULES_FILE): # 如果首次加载失败，尝试再次加载
        load_rules()
    app.run(host='0.0.0.0', port=5000, debug=True) # debug=True 方便开发调试
