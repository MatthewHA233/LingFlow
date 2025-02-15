from pydantic import BaseModel
from fastapi import HTTPException
import os

class SpeechRequest(BaseModel):
    audioUrl: str  # 必须的音频URL参数
    storageFormat: str = 'json'  # 可选存储格式

@router.post("/")
async def handle_speech_task(request: SpeechRequest):
    # 验证音频URL格式
    if not request.audioUrl.startswith('https://'):
        raise HTTPException(400, "音频链接必须使用HTTPS协议")
    
    # 调用核心逻辑
    try:
        result = fileTrans(
            akId=os.getenv('ALIYUN_AK_ID'),
            akSecret=os.getenv('ALIYUN_AK_SECRET'),
            appKey=os.getenv('NLS_APP_KEY'),
            audio_url=request.audioUrl,  # 使用验证后的参数
            storage_format=request.storageFormat
        )
        return result
    except Exception as e:
        raise HTTPException(500, detail=str(e)) 