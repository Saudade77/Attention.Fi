'use client';

import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  user: string;
  content: string;
  timestamp: number;
}

interface CommentSectionProps {
  marketId: number;
  userAddress: string;
}

export function CommentSection({ marketId, userAddress }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  // 从 localStorage 加载评论（简化版，生产环境应用后端）
  useEffect(() => {
    const stored = localStorage.getItem(`market_comments_${marketId}`);
    if (stored) {
      setComments(JSON.parse(stored));
    }
  }, [marketId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !userAddress) return;
    
    setLoading(true);
    
    const comment: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
      content: newComment.trim(),
      timestamp: Date.now()
    };
    
    const updated = [...comments, comment];
    setComments(updated);
    localStorage.setItem(`market_comments_${marketId}`, JSON.stringify(updated));
    setNewComment('');
    setLoading(false);
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        💬 Discussion ({comments.length})
      </h4>

      {/* 评论列表 */}
      <div className="max-h-48 overflow-y-auto mb-3 space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {comment.user}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(comment.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* 发表评论 */}
      {userAddress ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Share your thoughts..."
            className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '...' : 'Post'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Connect wallet to comment
        </p>
      )}
    </div>
  );
}