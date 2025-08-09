import csv
import requests
import os
import time
from urllib.parse import urlparse
import re

def sanitize_filename(filename):
    """清理文件名，移除不合法字符"""
    # 移除Windows不允许的字符
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    # 移除控制字符
    filename = re.sub(r'[\x00-\x1f\x7f]', '', filename)
    # 去除首尾空格和点
    filename = filename.strip('. ')
    return filename

def download_missing_voices():
    # 创建下载目录
    download_dir = 'voice_demos'
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
    
    # 读取CSV文件
    csv_path = 'public/音色列表.csv'
    
    with open(csv_path, 'r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        
        total_count = 0
        success_count = 0
        failed_downloads = []
        
        for row in reader:
            voice_id = row.get('voice_type', '').strip()
            voice_name = row.get('音色名称', '').strip()
            demo_urls_field = row.get('试听URL', '').strip()
            
            if not demo_urls_field:
                continue
            
            # 特别处理含有|分隔符的格式（日西语音色）
            if '|' in demo_urls_field and ';' in demo_urls_field:
                # 格式如：かずね（和音）|https://xxx.wav;Javier or Álvaro|https://yyy.wav
                try:
                    pairs = demo_urls_field.split(';')
                    for pair in pairs:
                        if '|' in pair:
                            parts = pair.split('|')
                            if len(parts) == 2:
                                demo_name = parts[0].strip()
                                demo_url = parts[1].strip()
                                
                                if demo_url.startswith('http'):
                                    total_count += 1
                                    
                                    # 确定文件扩展名
                                    ext = '.wav' if '.wav' in demo_url else '.mp3'
                                    
                                    # 生成文件名
                                    safe_demo_name = sanitize_filename(demo_name)
                                    filename = f"{voice_id}_{safe_demo_name}{ext}"
                                    filename = sanitize_filename(filename)
                                    filepath = os.path.join(download_dir, filename)
                                    
                                    # 如果文件已存在，跳过
                                    if os.path.exists(filepath):
                                        print(f"✓ 已存在: {filename}")
                                        success_count += 1
                                        continue
                                    
                                    # 下载文件
                                    try:
                                        print(f"下载中 [{total_count}]: {filename}")
                                        print(f"  URL: {demo_url}")
                                        
                                        response = requests.get(demo_url, timeout=30, headers={
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                        })
                                        
                                        if response.status_code == 200:
                                            with open(filepath, 'wb') as f:
                                                f.write(response.content)
                                            print(f"  ✓ 成功: {filename} ({len(response.content)/1024:.1f} KB)")
                                            success_count += 1
                                        else:
                                            print(f"  ✗ 失败: HTTP {response.status_code}")
                                            failed_downloads.append({
                                                'voice': voice_name,
                                                'demo': demo_name,
                                                'url': demo_url,
                                                'error': f"HTTP {response.status_code}"
                                            })
                                    
                                    except Exception as e:
                                        print(f"  ✗ 下载失败: {str(e)}")
                                        failed_downloads.append({
                                            'voice': voice_name,
                                            'demo': demo_name,
                                            'url': demo_url,
                                            'error': str(e)
                                        })
                                    
                                    # 添加延迟
                                    time.sleep(0.5)
                
                except Exception as e:
                    print(f"✗ 处理 {voice_name} 时出错: {str(e)}")
                    continue
        
        # 打印统计信息
        print("\n" + "="*60)
        print(f"下载完成统计:")
        print(f"  总计: {total_count} 个文件")
        print(f"  成功: {success_count} 个文件")
        print(f"  失败: {len(failed_downloads)} 个文件")
        
        if failed_downloads:
            print(f"\n失败的下载:")
            for item in failed_downloads:
                print(f"  - {item['voice']} / {item['demo']}: {item['error']}")

if __name__ == "__main__":
    print("开始下载缺失的日西语音色文件...")
    print("="*60)
    download_missing_voices()