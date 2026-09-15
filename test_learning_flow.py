import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_flow():
    # 1. Get repos
    repos = requests.get(f"{BASE_URL}/api/repositories").json()
    ready_repos = [r for r in repos if r.get("current_snapshot_id")]
    assert ready_repos, "No indexed repositories available"
    repo = ready_repos[0]
    repo_id = repo["id"]
    print(f"Using repo {repo['name']} (ID: {repo_id})")

    # 2. Create learning path
    payload = {
        "goal": "Understand payment authorization and idempotency",
        "experience_level": "intermediate",
        "topic": "payment flow"
    }
    print("Creating learning path via Groq...")
    res = requests.post(f"{BASE_URL}/api/repositories/{repo_id}/learning-paths", json=payload, timeout=40)
    print("Create status:", res.status_code)
    assert res.status_code == 200, f"Failed: {res.text}"
    path_data = res.json()
    print(f"Created Learning Path: {path_data['id']}")
    print(f"Lessons generated: {len(path_data['lessons'])}")
    for l in path_data['lessons']:
        print(f"  [{l['order_index']}] {l['title']} (status: {l['status']})")

    # 3. Fetch full lesson detail
    first_lesson_id = path_data['lessons'][0]['id']
    lesson_res = requests.get(f"{BASE_URL}/api/lessons/{first_lesson_id}")
    assert lesson_res.status_code == 200, f"Failed getting lesson: {lesson_res.text}"
    lesson_detail = lesson_res.json()
    print("\nFirst Lesson Detail:")
    print("Title:", lesson_detail["title"])
    print("Objective:", lesson_detail["objective"])
    print("Exercise Prompt:", lesson_detail["exercise_prompt"])
    print("Code References count:", len(lesson_detail["code_references"]))

    # 4. Submit an exercise attempt
    print("\nSubmitting exercise attempt to evaluator...")
    attempt_payload = {
        "user_answer": (
            "The process_payment function checks if an idempotency_key already exists in the database. "
            "If it exists and was processed, it returns the cached transaction record instead of charging the payment gateway again. "
            "If not, it calls the payment provider, validates the response, records the transaction in the database, and returns the result."
        )
    }
    attempt_res = requests.post(f"{BASE_URL}/api/lessons/{first_lesson_id}/attempts", json=attempt_payload, timeout=30)
    print("Attempt evaluation status:", attempt_res.status_code)
    assert attempt_res.status_code == 200, f"Attempt failed: {attempt_res.text}"
    attempt_data = attempt_res.json()
    print("Evaluation Outcome:", attempt_data["outcome"])
    print("Feedback (Understood):", attempt_data["feedback_what_understood"])
    print("Feedback (Missed):", attempt_data.get("feedback_what_missed"))
    print("Explanation:", attempt_data["explanation"])
    print("Recommended Action:", attempt_data["recommended_next_action"])

    # 5. Check progress update
    prog_res = requests.get(f"{BASE_URL}/api/repositories/{repo_id}/progress")
    if prog_res.status_code == 200:
        prog = prog_res.json()
        print("\nUser Progress Summary:")
        print("Total lessons:", prog.get("total_lessons"))
        print("Demonstrated count:", prog.get("demonstrated_count"))
        print("Exercise outcomes:", prog.get("exercise_outcomes"))
        print("Lessons visited:", prog.get("lessons_visited"))

    print("\n=== ALL LEARNING & EVALUATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_flow()
