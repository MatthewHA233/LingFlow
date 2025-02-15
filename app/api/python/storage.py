import json
import csv
import os
from datetime import datetime
from pathlib import Path
import requests
import uuid

class ResultStorage:
    def __init__(self, output_dir="results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def save(self, result, format='json'):
        """保存识别结果，包含词级别时间戳"""
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        task_id = result.get('taskId', 'unknown')
        filename = f"{timestamp}_{task_id[:8]}"
        
        # 处理结果数据
        processed_result = self._process_result(result)
        
        # 保存文件
        if format == 'json':
            return self._save_json(processed_result, filename)
        elif format == 'csv':
            return self._save_detailed_csv(processed_result, filename)
        elif format == 'supabase':
            return self._save_to_supabase(processed_result)
        else:
            raise ValueError("不支持的格式，请选择 json, csv 或 supabase")
    
    def _process_result(self, result):
        """处理结果，添加UUID和句子关联"""
        # 为每个句子生成UUID
        sentences = []
        sentence_map = {}  # 用于存储时间范围到句子ID的映射
        
        for sentence in result.get('results', []):
            sentence_id = str(uuid.uuid4())
            sentence_data = {
                **sentence,
                'id': sentence_id,
                'speech_id': str(uuid.uuid4()),  # 为每个speech记录生成ID
                'text_content': sentence['Text'],
                'begin_time': sentence['BeginTime'],
                'end_time': sentence['EndTime'],
                'speech_rate': sentence.get('SpeechRate'),
                'emotion_value': sentence.get('EmotionValue')
            }
            sentences.append(sentence_data)
            # 记录这个句子的时间范围
            sentence_map[(sentence['BeginTime'], sentence['EndTime'])] = sentence_id

        # 为每个词找到对应的句子ID
        words = []
        for word in result.get('words', []):
            word_time = word['BeginTime']
            # 找到这个词属于哪个句子
            sentence_id = None
            for (sent_start, sent_end), sent_id in sentence_map.items():
                if sent_start <= word_time <= sent_end:
                    sentence_id = sent_id
                    break
            
            word_data = {
                'id': str(uuid.uuid4()),
                'sentence_id': sentence_id,
                'word': word['Word'].strip(),
                'begin_time': word['BeginTime'],
                'end_time': word['EndTime']
            }
            words.append(word_data)

        # 构建最终结果
        processed_result = {
            **result,
            'sentences': sentences,
            'words': words,
            'speech_results': [{
                'id': str(uuid.uuid4()),
                'task_id': result.get('taskId'),
                'audio_url': result.get('audio_url'),
                'user_id': None,  # 这个需要从认证上下文中获取
                'created_at': datetime.now().isoformat()
            }]
        }
        
        return processed_result
            
    def _save_json(self, data, filename):
        filepath = self.output_dir / f"{filename}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
            
    def _save_detailed_csv(self, data, filename):
        filepath = self.output_dir / f"{filename}.csv"
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # 添加表头
            writer.writerow([
                "句子ID", "开始时间(ms)", "结束时间(ms)", "文本内容", 
                "语速(字/分)", "情感值", "词ID", "词内容", "词开始时间", "词结束时间"
            ])
            
            # 写入数据
            for sentence in data['sentences']:
                # 获取属于这个句子的词
                sentence_words = [w for w in data['words'] if w['sentence_id'] == sentence['id']]
                
                if sentence_words:
                    for word in sentence_words:
                        writer.writerow([
                            sentence['id'],
                            sentence['begin_time'],
                            sentence['end_time'],
                            sentence['text_content'],
                            sentence.get('speech_rate', 'N/A'),
                            sentence.get('emotion_value', 'N/A'),
                            word['id'],
                            word['word'],
                            word['begin_time'],
                            word['end_time']
                        ])
                else:
                    # 如果句子没有对应的词，也要写入句子信息
                    writer.writerow([
                        sentence['id'],
                        sentence['begin_time'],
                        sentence['end_time'],
                        sentence['text_content'],
                        sentence.get('speech_rate', 'N/A'),
                        sentence.get('emotion_value', 'N/A'),
                        '', '', '', ''
                    ])
        
        return filepath

    def _save_to_supabase(self, data):
        """通过API路由保存到Supabase"""
        api_url = "http://localhost:3000/api/save-result"  # Next.js开发地址
        try:
            response = requests.post(
                api_url,
                json=data,
                headers={"Content-Type": "application/json"}
            )
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}