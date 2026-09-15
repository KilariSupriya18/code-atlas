import requests
import time

res = requests.post('http://127.0.0.1:8000/api/repositories', json={'url': 'https://github.com/demo/sample-repo', 'branch': 'main'})
print('Create Status:', res.status_code)
data = res.json()
print('Data:', data)
job_id = data['job_id']

for i in range(20):
    j_res = requests.get(f'http://127.0.0.1:8000/api/jobs/{job_id}')
    j_data = j_res.json()
    stage = j_data['stage']
    stats = j_data.get('progress_stats')
    print(f"[{i}s] Stage: {stage}, Stats: {stats}")
    if stage in ('ready', 'failed'):
        if stage == 'failed':
            print("Error message:", j_data.get('error_message'))
        break
    time.sleep(1)

print("Indexing flow test completed!")
