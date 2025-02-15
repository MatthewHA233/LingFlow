# -*- coding: utf8 -*-
import json
import time
import os  # 添加os模块导入
from aliyunsdkcore.acs_exception.exceptions import ClientException
from aliyunsdkcore.acs_exception.exceptions import ServerException
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.request import CommonRequest
from dotenv import load_dotenv  # 添加dotenv支持

load_dotenv()  # 加载环境变量

def fileTrans(akId, akSecret, appKey, fileLink) :
    # 地域ID，固定值。
    REGION_ID = "cn-shanghai"
    PRODUCT = "nls-filetrans"
    DOMAIN = "filetrans.cn-shanghai.aliyuncs.com"
    API_VERSION = "2018-08-17"
    POST_REQUEST_ACTION = "SubmitTask"
    GET_REQUEST_ACTION = "GetTaskResult"
    # 请求参数
    KEY_APP_KEY = "appkey"
    KEY_FILE_LINK = "file_link"
    KEY_VERSION = "version"
    KEY_ENABLE_WORDS = "enable_words"
    # 是否开启智能分轨
    KEY_AUTO_SPLIT = "auto_split"
    # 响应参数
    KEY_TASK = "Task"
    KEY_TASK_ID = "TaskId"
    KEY_STATUS_TEXT = "StatusText"
    KEY_RESULT = "Result"
    # 状态值
    STATUS_SUCCESS = "SUCCESS"
    STATUS_RUNNING = "RUNNING"
    STATUS_QUEUEING = "QUEUEING"
    
    # 创建AcsClient实例
    client = AcsClient(akId, akSecret, REGION_ID)
    
    # 提交录音文件识别请求
    postRequest = CommonRequest()
    postRequest.set_domain(DOMAIN)
    postRequest.set_version(API_VERSION)
    postRequest.set_product(PRODUCT)
    postRequest.set_action_name(POST_REQUEST_ACTION)
    postRequest.set_method('POST')

    # 配置任务参数
    task = {
        KEY_APP_KEY: appKey,
        KEY_FILE_LINK: fileLink,
        KEY_VERSION: "4.0",
        KEY_ENABLE_WORDS: True,  # 开启词级别时间戳
        "enable_timestamp_alignment": True,  # 开启时间戳对齐
        "max_single_segment_time": 10000,  # 最大单句时长（毫秒）
        "enable_intermediate_result": True,  # 开启中间结果返回
        "enable_punctuation_prediction": True,  # 开启标点符号预测
        "enable_inverse_text_normalization": True,  # 开启ITN
        # 新增自动降采样参数
        "enable_sample_rate_adaptive": True  # 开启自动降采样
    }
    
    task = json.dumps(task)
    print("提交任务配置：", task)
    postRequest.add_body_params(KEY_TASK, task)
    
    # 提交任务
    try:
        postResponse = client.do_action_with_exception(postRequest)
        postResponse = json.loads(postResponse)
        print("任务提交结果：", postResponse)
        
        statusText = postResponse[KEY_STATUS_TEXT]
        if statusText == STATUS_SUCCESS:
            print("录音文件识别请求成功响应！")
            taskId = postResponse[KEY_TASK_ID]
        else:
            print("录音文件识别请求失败！")
            return
    except (ServerException, ClientException) as e:
        print(f"提交任务异常：{str(e)}")
        return

    # 查询结果
    getRequest = CommonRequest()
    getRequest.set_domain(DOMAIN)
    getRequest.set_version(API_VERSION)
    getRequest.set_product(PRODUCT)
    getRequest.set_action_name(GET_REQUEST_ACTION)
    getRequest.set_method('GET')
    getRequest.add_query_param(KEY_TASK_ID, taskId)

    # 轮询获取结果
    statusText = ""
    results = []  # 存储所有识别结果
    retry_count = 0
    max_retries = 3  # 最大重试次数
    
    while True:
        try:
            getResponse = client.do_action_with_exception(getRequest)
            getResponse = json.loads(getResponse)
            print("查询结果：", getResponse)
            
            statusText = getResponse[KEY_STATUS_TEXT]
            
            # 处理中间结果
            if KEY_RESULT in getResponse:
                current_result = getResponse[KEY_RESULT]
                if "Sentences" in current_result:
                    results = current_result["Sentences"]
                    print(f"任务正在处理中，已识别{len(results)}句...")
                    # 显示最新的3句结果
                    for sent in results[-3:]:
                        print(f"{format_time(sent['BeginTime'])} -> {format_time(sent['EndTime'])}: {sent['Text']}")

            # 状态判断
            if statusText == STATUS_RUNNING or statusText == STATUS_QUEUEING:
                time.sleep(10)
                continue
            elif statusText == STATUS_SUCCESS:
                print("录音文件识别成功！")
                break
            else:
                print(f"识别失败，状态：{statusText}")
                if retry_count < max_retries:
                    retry_count += 1
                    print(f"第{retry_count}次重试...")
                    time.sleep(3)
                    continue
                break
                
        except (ServerException, ClientException) as e:
            print(f"查询结果异常：{str(e)}")
            if retry_count < max_retries:
                retry_count += 1
                print(f"第{retry_count}次重试...")
                time.sleep(3)
                continue
            break

    # 返回最终结果
    return {
        "status": statusText,
        "results": results,
        "taskId": taskId
    }

def format_time(milliseconds):
    """将毫秒转换为可读时间格式"""
    seconds = milliseconds / 1000
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"

if __name__ == "__main__":
    accessKeyId = os.getenv('ALIYUN_AK_ID')
    accessKeySecret = os.getenv('ALIYUN_AK_SECRET')
    appKey = os.getenv('NLS_APP_KEY')
    fileLink = "https://s31.aconvert.com/convert/p3r68-cdx67/4eabr-jcums.wav"
    
    # 执行录音文件识别
    result = fileTrans(accessKeyId, accessKeySecret, appKey, fileLink)
    
    if result and result.get("status") == "SUCCESS":
        print("\n完整识别结果：")
        for sent in result["results"]:
            print(f"{format_time(sent['BeginTime'])} -> {format_time(sent['EndTime'])}: {sent['Text']}")