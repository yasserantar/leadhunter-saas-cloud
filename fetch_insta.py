import instaloader
import io

L = instaloader.Instaloader()

shortcodes = ['DZpk6B7MIai', 'DZ5bXtIjbyl']

with io.open("C:\\LeadHunter-Pro-AI\\captions.txt", "w", encoding="utf-8") as f:
    for shortcode in shortcodes:
        f.write(f"\n--- Fetching post {shortcode} ---\n")
        try:
            post = instaloader.Post.from_shortcode(L.context, shortcode)
            f.write("Caption:\n")
            f.write(post.caption + "\n")
        except Exception as e:
            f.write(f"Failed to fetch {shortcode}: {e}\n")
