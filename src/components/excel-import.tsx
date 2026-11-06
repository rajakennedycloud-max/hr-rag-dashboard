"use client";

import { useState, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelImportProps {
  onImportSuccess: (count: number) => void;
  className?: string;
}

export default function ExcelImport({ onImportSuccess, className }: ExcelImportProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<any>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setSuccess(null);
    setImportResults(null);
    setUploading(true);

    try {
      // Validate file type
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/candidates/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          setError(`Validation errors: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`);
        } else {
          setError(result.error || 'Import failed');
        }
        return;
      }

      setSuccess(result.message || "Import completed");
      setImportResults(result);
      onImportSuccess(result.created ?? result.imported ?? 0);

    } catch (err) {
      setError('Import failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onImportSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const clearResults = useCallback(() => {
    setImportResults(null);
    setSuccess(null);
    setError(null);
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Import Candidate Report</h3>
      </div>

      {!importResults ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          
          <div className="space-y-4">
            <FileSpreadsheet className={cn(
              "w-12 h-12 mx-auto",
              uploading ? "text-blue-500 animate-pulse" : "text-gray-400"
            )} />
            
            <div>
              <p className="text-lg font-medium text-gray-600">
                {uploading ? "Processing Excel file..." : "Drop Excel file here or click to browse"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Import multiple candidates at once using Excel template
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Max file size: 5MB • Supported formats: .xlsx, .xls
              </p>
            </div>

            <div className="text-left bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">How it works:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Upload the daily "Candidate Report" workbook as-is</li>
                <li>• New candidates are created automatically</li>
                <li>• Changed rows update in place (with audit trail)</li>
                <li>• Unchanged rows are skipped — safe to re-upload</li>
                <li>• Recruiter names are matched to user accounts</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900">Import Completed!</h4>
              </div>
              
              <div className="text-sm text-green-800 space-y-1">
                <p>✅ Added: <strong>{importResults.created ?? 0}</strong></p>
                <p>🔄 Updated: <strong>{importResults.updated ?? 0}</strong></p>
                <p>⏭️ Unchanged: <strong>{importResults.unchanged ?? 0}</strong></p>
                {importResults.missing > 0 && (
                  <p>❗ Missing from snapshot: <strong>{importResults.missing}</strong></p>
                )}
                {importResults.skipped > 0 && (
                  <p>⚠️ Skipped: <strong>{importResults.skipped}</strong> rows</p>
                )}
              </div>

              {importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {importResults.errors.slice(0, 5).map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {importResults.errors.length > 5 && (
                      <li>• ... and {importResults.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            
            <button
              onClick={clearResults}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && !importResults && (
        <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}
    </div>
  );
}
