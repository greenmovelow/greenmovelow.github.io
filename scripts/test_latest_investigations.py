"""Offline regression tests for feed updates and assigned Substack sections."""

import html
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import build_latest_investigations as feed


SECTION = 450391
SECTION_NAME = "Voting Rights & Election Systems"


def rss(slugs=("supreme-court",), category="Brenna Bird"):
    items = []
    for slug in slugs:
        items.append(
            f"<item><title>{html.escape(slug)}</title>"
            f"<link>{feed.PUBLICATION_URL}/p/{slug}</link>"
            "<pubDate>Sat, 26 Sep 2026 02:28:47 GMT</pubDate>"
            f"<category>{html.escape(category)}</category></item>"
        )
    return "<rss><channel>" + "".join(items) + "</channel></rss>"


def homepage(sections=None):
    if sections is None:
        sections = [{"id": SECTION, "name": SECTION_NAME}]
    data = {"pub": {"sections": sections}}
    return "window._preloads = JSON.parse(" + json.dumps(json.dumps(data)) + ");"


class FeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "latest-investigations.json"
        self.output_patch = patch.object(feed, "OUTPUT", self.output)
        self.output_patch.start()
        self.addCleanup(self.output_patch.stop)

    def previous(self, slug="supreme-court", category=SECTION_NAME, section=SECTION):
        return {
            "title": slug,
            "link": feed.PUBLICATION_URL + "/p/" + slug,
            "date": "2026-09-26",
            "dateLabel": "Sep 26",
            "sectionId": section,
            "category": category,
            "categorySource": "section",
        }

    def seed(self, items):
        self.output.write_text(json.dumps({"source": feed.FEED_URL, "items": items}) + "\n")

    def run_build(self, raw=None, home=None, posts=None):
        calls = []
        posts = posts or {}

        def fetch(url, timeout=feed.TIMEOUT_SECONDS):
            calls.append(url)
            if url == feed.FEED_URL:
                result = rss() if raw is None else raw
            elif url == feed.PUBLICATION_URL:
                result = homepage() if home is None else home
            else:
                slug = url.removeprefix(feed.POST_API_PREFIX)
                result = posts.get(slug, {
                    "slug": slug, "section_id": SECTION,
                    "postTags": [{"name": "Brenna Bird"}, {"name": "voting rights"}],
                    "body_html": "This response body must never be stored.",
                })
                if isinstance(result, dict):
                    result = json.dumps(result)
            if isinstance(result, Exception):
                raise result
            return result

        with patch.object(feed, "fetch_text", side_effect=fetch), redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            result = feed.main()
        output = json.loads(self.output.read_text()) if self.output.exists() else None
        return result, output, calls

    def test_assigned_section_wins_over_first_tag_and_rss_category(self):
        code, data, _ = self.run_build()
        self.assertEqual(code, 0)
        item = data["items"][0]
        self.assertEqual(item["category"], SECTION_NAME)
        self.assertEqual(item["sectionId"], SECTION)
        self.assertEqual(item["categorySource"], "section")
        self.assertNotIn("body_html", item)
        self.assertNotIn("postTags", item)

    def test_failed_post_lookup_keeps_last_verified_label_but_updates_story(self):
        old = self.previous()
        old["title"] = "Old title"
        self.seed([old])
        code, data, _ = self.run_build(posts={"supreme-court": TimeoutError("offline")})
        self.assertEqual(code, 0)
        self.assertEqual(data["items"][0]["title"], "supreme-court")
        self.assertEqual(data["items"][0]["category"], SECTION_NAME)

    def test_new_story_imports_without_label_when_metadata_unavailable(self):
        code, data, _ = self.run_build(posts={"supreme-court": TimeoutError("offline")})
        self.assertEqual(code, 0)
        self.assertEqual(data["items"][0]["category"], "")

    def test_legacy_investigation_label_is_not_a_cached_section(self):
        old = self.previous(category="Investigation")
        del old["categorySource"]
        self.seed([old])
        _, data, _ = self.run_build(posts={"supreme-court": TimeoutError("offline")})
        self.assertEqual(data["items"][0]["category"], "")

    def test_failed_publication_lookup_uses_cached_section_for_new_story(self):
        self.seed([self.previous(slug="older")])
        _, data, _ = self.run_build(home=ValueError("changed HTML"))
        self.assertEqual(data["items"][0]["category"], SECTION_NAME)

    def test_new_section_id_cannot_inherit_old_category(self):
        self.seed([self.previous()])
        _, data, _ = self.run_build(posts={"supreme-court": {"slug": "supreme-court", "section_id": 999, "postTags": [{"name": "Immigration"}]}})
        self.assertEqual(data["items"][0]["sectionId"], 999)
        self.assertEqual(data["items"][0]["category"], "")

    def test_explicitly_unassigned_section_removes_old_label(self):
        self.seed([self.previous()])
        _, data, _ = self.run_build(posts={"supreme-court": {"slug": "supreme-court", "section_id": None, "postTags": [{"name": "Brenna Bird"}]}})
        self.assertIsNone(data["items"][0]["sectionId"])
        self.assertEqual(data["items"][0]["category"], "")

    def test_section_rename_refreshes_without_rss_change(self):
        self.seed([self.previous()])
        _, data, _ = self.run_build(home=homepage([{"id": SECTION, "name": "Renamed section"}]))
        self.assertEqual(data["items"][0]["category"], "Renamed section")

    def test_section_reassignment_refreshes_without_rss_change(self):
        self.seed([self.previous()])
        _, data, _ = self.run_build(home=homepage([{"id": 141602, "name": "Immigration"}]), posts={"supreme-court": {"slug": "supreme-court", "section_id": 141602}})
        self.assertEqual(data["items"][0]["category"], "Immigration")

    def test_missing_section_field_or_wrong_post_preserves_last_good_label(self):
        for bad in ({"slug": "supreme-court"}, {"slug": "other", "section_id": None}, {"slug": "supreme-court", "section_id": True}):
            with self.subTest(post=bad):
                self.seed([self.previous()])
                _, data, _ = self.run_build(posts={"supreme-court": bad})
                self.assertEqual(data["items"][0]["category"], SECTION_NAME)

    def test_sections_are_plain_text_and_whitespace_is_normalized(self):
        _, data, _ = self.run_build(home=homepage([{"id": SECTION, "name": " <b>Voting</b>  rights &amp; elections \n"}]))
        self.assertEqual(data["items"][0]["category"], "Voting rights & elections")

    def test_identical_run_does_not_rewrite_file(self):
        self.run_build()
        before = self.output.stat().st_mtime_ns
        code, _, _ = self.run_build()
        self.assertEqual(code, 0)
        self.assertEqual(self.output.stat().st_mtime_ns, before)

    def test_rss_failures_keep_entire_previous_file(self):
        self.seed([self.previous()])
        before = self.output.read_bytes()
        for raw in (TimeoutError("offline"), "<bad", "<rss/>", "<!DOCTYPE rss [<!ENTITY x 'x'>]><rss/>"):
            with self.subTest(raw=raw):
                code, _, calls = self.run_build(raw=raw)
                self.assertEqual(code, 1)
                self.assertEqual(self.output.read_bytes(), before)
                self.assertEqual(calls, [feed.FEED_URL])

    def test_supporting_posts_and_items_beyond_limit_do_not_trigger_lookups(self):
        slugs = ["evidence-locker-court"] + [f"article-{i}" for i in range(14)]
        _, data, calls = self.run_build(raw=rss(slugs))
        self.assertEqual(len(data["items"]), feed.MAX_ITEMS)
        self.assertEqual(len(calls), feed.MAX_ITEMS + 2)
        self.assertNotIn(feed.POST_API_PREFIX + "evidence-locker-court", calls)
        self.assertNotIn(feed.POST_API_PREFIX + "article-11", calls)

    def test_corrupt_cache_is_replaced(self):
        self.output.write_text("[null]")
        code, data, _ = self.run_build()
        self.assertEqual(code, 0)
        self.assertEqual(data["items"][0]["category"], SECTION_NAME)

    def test_links_cannot_supply_arbitrary_metadata_urls(self):
        for link in ("https://example.com/p/foo", "http://exposed1.substack.com/p/foo", feed.PUBLICATION_URL + "/p/foo/bar", feed.PUBLICATION_URL + "/p/../api", "https://[invalid/p/foo"):
            self.assertIsNone(feed.normalize_link(link))
        self.assertEqual(feed.normalize_link("https://exposed1.substack.com/p/foo?tracking=1#comments"), feed.PUBLICATION_URL + "/p/foo")

    def test_redirects_cannot_leave_publication(self):
        handler = feed.PublicationRedirectHandler()
        with self.assertRaises(ValueError):
            handler.redirect_request(None, None, 302, "", {}, "https://example.com/private")


if __name__ == "__main__":
    unittest.main()
