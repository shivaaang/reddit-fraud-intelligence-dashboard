"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatNumber, toTitleCase } from "@/lib/utils";
import type { DrillDownPost } from "@/lib/types/drill-down";

interface DrillDownPostsProps {
  posts: DrillDownPost[];
  totalCount: number;
  filters: Record<string, string>;
}

export function DrillDownPosts({
  posts: initialPosts,
  totalCount,
  filters,
}: DrillDownPostsProps) {
  const [posts, setPosts] = useState<DrillDownPost[]>(initialPosts);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset displayed posts when initial data changes
  const postsKey = initialPosts.map((p) => p.postId).join(",");
  const [prevKey, setPrevKey] = useState(postsKey);
  if (postsKey !== prevKey) {
    setPosts(initialPosts);
    setPrevKey(postsKey);
  }

  const remaining = totalCount - posts.length;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        posts_offset: String(posts.length),
        posts_limit: "10",
      });
      const res = await fetch(`/api/drill-down?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.posts?.length) {
        setPosts((prev) => [...prev, ...data.posts]);
      }
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  function formatDate(utc: string) {
    return new Date(utc).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-fog-800">Source Posts</h3>
        <span className="text-xs text-fog-500">
          Showing {posts.length} of {formatNumber(totalCount)}
        </span>
      </div>

      {/* Post cards */}
      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.postId}
            className="bg-white rounded-lg border border-fog-200 p-4 hover:border-ube-300 hover:shadow-sm transition-all relative"
          >
            {/* Title + external link */}
            <div className="flex items-start gap-2">
              <h4 className="text-sm font-medium text-fog-800 leading-snug line-clamp-2 flex-1">
                {post.title}
              </h4>
              <a
                href={`https://reddit.com${post.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ube-1000 hover:opacity-70 shrink-0 mt-0.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-fog-500 flex-wrap">
              <span className="bg-ube-100 text-ube-1000 rounded-full px-2 py-0.5 text-xs font-medium">
                r/{post.subreddit}
              </span>
              <span>&middot;</span>
              <span>Upvotes: {post.score}</span>
              <span>&middot;</span>
              <span>{post.numComments}c</span>
              <span>&middot;</span>
              <span>{formatDate(post.createdUtc)}</span>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-fog-100 text-fog-500"
                  >
                    {toTitleCase(tag)}
                  </span>
                ))}
              </div>
            )}

            {/* Quote snippet */}
            {post.notableQuote && (
              <p className="text-xs text-fog-500 italic line-clamp-2 mt-2">
                &ldquo;{post.notableQuote}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Load more */}
      {remaining > 0 && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2.5 text-sm font-medium text-ube-1000 bg-ube-100 hover:bg-ube-150 rounded-lg mt-3 transition-colors disabled:opacity-60"
        >
          {loadingMore ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-ube-600 border-t-transparent rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            `Show more posts (${formatNumber(remaining)} remaining)`
          )}
        </button>
      )}
    </div>
  );
}
