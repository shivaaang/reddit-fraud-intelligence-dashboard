"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { toTitleCase, formatNumber } from "@/lib/utils";

interface Post {
  postId: string;
  title: string;
  subreddit: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: string;
}

interface PostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filters: Record<string, string>;
}

export function PostsModal({ isOpen, onClose, title, filters }: PostsModalProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ...filters, page: String(p) });
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setError(String(err));
      setPosts([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchPosts(1);
    }
  }, [isOpen, fetchPosts]);

  useEffect(() => {
    if (isOpen) {
      fetchPosts(page);
    }
  }, [page, isOpen, fetchPosts]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col mx-4 modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fog-200">
          <div>
            <h2 className="text-lg font-semibold text-fog-800">{title}</h2>
            <p className="text-sm text-fog-500">
              {formatNumber(total)} posts found
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-fog-100 transition-colors"
          >
            <X className="w-5 h-5 text-fog-500" />
          </button>
        </div>

        {/* Active Filters */}
        <div className="px-6 py-2 flex flex-wrap gap-2 border-b border-fog-200">
          {Object.entries(filters)
            .filter(([k]) => k !== "type")
            .map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-0.5 text-xs font-medium rounded-full bg-ube-100 text-ube-1000"
              >
                {toTitleCase(key)}: {toTitleCase(value)}
              </span>
            ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-ube-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-sm text-red-600">
              <p>Error loading posts: {error}</p>
            </div>
          ) : (
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[80px]" />
                <col className="w-[60px]" />
              </colgroup>
              <thead className="sticky top-0 bg-fog-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                    Subreddit
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-fog-500 uppercase tracking-wider">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog-200">
                {posts.map((post) => (
                  <tr
                    key={post.postId}
                    className="hover:bg-ube-100/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-fog-500 whitespace-nowrap">
                      {new Date(post.createdUtc).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm overflow-hidden">
                      <span className="px-2 py-0.5 rounded-full bg-ube-100 text-ube-1000 text-xs font-medium whitespace-nowrap block truncate max-w-[130px]">
                        r/{post.subreddit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-fog-800 truncate">
                      {post.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-fog-600 text-right">
                      {post.score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`https://reddit.com${post.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-ube-1000 hover:opacity-70"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-fog-200">
            <p className="text-sm text-fog-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-fog-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-fog-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
