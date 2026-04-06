import { useState, useEffect } from "react";
import {
  Edit,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { wizardService } from "@/features/wizard/services/wizardService";
import type {
  WizardQuestion,
  WizardOption,
} from "@/features/wizard/services/wizardService";

export default function AdminWizardQuestionsPage() {
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] =
    useState<WizardQuestion | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<Partial<WizardQuestion> | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const data = await wizardService.getAllQuestionsForAdmin();
      setQuestions(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (question: WizardQuestion) => {
    try {
      const detail = await wizardService.getQuestionDetailForAdmin(
        Number(question.id),
      );
      setSelectedQuestion(detail);
      setShowDetailModal(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to load question details");
    }
  };

  const handleEdit = async (question: WizardQuestion) => {
    try {
      const detail = await wizardService.getQuestionDetailForAdmin(
        Number(question.id),
      );
      setEditingQuestion(detail);
      setShowEditModal(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to load question for editing");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;

    // Validate options
    if (editingQuestion.options) {
      const invalidOptions = editingQuestion.options.filter(
        (opt) => !opt.value?.trim() || !opt.label?.trim(),
      );

      if (invalidOptions.length > 0) {
        toast.error("All options must have both value and label filled in");
        return;
      }
    }

    try {
      const {
        id,
        code,
        label,
        helpText,
        inputType,
        isActive,
        sortOrder,
        options,
      } = editingQuestion;

      // Build payload with only fields allowed by UpdateWizardQuestionDto
      const cleanedPayload = {
        code,
        label,
        helpText,
        inputType,
        isActive,
        sortOrder,
        options: options?.map((opt) => ({
          id: opt.id,
          value: opt.value.trim(),
          label: opt.label.trim(),
          sortOrder: Number(opt.sortOrder) || 0,
        })),
      };

      if (id) {
        await wizardService.updateWizardQuestion(Number(id), cleanedPayload);
        toast.success("Question updated successfully");
      } else {
        await wizardService.createWizardQuestion(cleanedPayload);
        toast.success("Question created successfully");
      }
      setShowEditModal(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (error: any) {
      console.error("[AdminWizardQuestionsPage] Update error:", error);
      console.error(
        "[AdminWizardQuestionsPage] Error response:",
        error.response?.data,
      );
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update question",
      );
    }
  };

  const updateEditingField = (field: string, value: any) => {
    setEditingQuestion((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const addOption = () => {
    if (!editingQuestion) return;
    const newOption: Partial<WizardOption> = {
      value: "",
      label: "",
      sortOrder: (editingQuestion.options?.length || 0) + 1,
    };
    setEditingQuestion({
      ...editingQuestion,
      options: [...(editingQuestion.options || []), newOption as WizardOption],
    });
  };

  const updateOption = (index: number, field: string, value: any) => {
    if (!editingQuestion?.options) return;
    const updated = [...editingQuestion.options];
    updated[index] = { ...updated[index], [field]: value };
    setEditingQuestion({ ...editingQuestion, options: updated });
  };

  const removeOption = (index: number) => {
    if (!editingQuestion?.options) return;
    const updated = editingQuestion.options.filter((_, i) => i !== index);
    setEditingQuestion({ ...editingQuestion, options: updated });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Wizard Questions Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage questions in the Project Request creation flow
          </p>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                No.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Question
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Options
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questions.map((question, index) => (
              <tr key={question.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {question.sortOrder || index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                  {question.code}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="max-w-md">{question.label}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {question.options?.length || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleViewDetail(question)}
                    className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(question)}
                    className="text-yellow-600 hover:text-yellow-900 inline-flex items-center"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedQuestion && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
                  Wizard Question
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                  Question Details
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Code
                </label>
                <p className="mt-1 inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-mono text-gray-800">
                  {selectedQuestion.code}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Question
                </label>
                <p className="mt-2 text-sm text-gray-900 leading-relaxed">
                  {selectedQuestion.label}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Help Text
                </label>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">
                  {selectedQuestion.helpText || "N/A"}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Options ({selectedQuestion.options?.length || 0})
                  </label>
                </div>
                <div className="mt-1 space-y-2">
                  {selectedQuestion.options?.map((option, index) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-500 shadow-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {option.label}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            Value:{" "}
                            <span className="font-normal">{option.value}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
                  Wizard Question
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                  Edit Question
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Code
                </label>
                <input
                  type="text"
                  value={editingQuestion.code || ""}
                  onChange={(e) => updateEditingField("code", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Question
                </label>
                <textarea
                  value={editingQuestion.label || ""}
                  onChange={(e) => updateEditingField("label", e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Help Text
                </label>
                <textarea
                  value={editingQuestion.helpText || ""}
                  onChange={(e) =>
                    updateEditingField("helpText", e.target.value)
                  }
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Options Editor */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Options ({editingQuestion.options?.length || 0})
                  </label>
                  <button
                    onClick={addOption}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </button>
                </div>

                <div className="space-y-3">
                  {editingQuestion.options?.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-2 p-3 bg-gray-50 rounded"
                    >
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Value"
                          value={option.value || ""}
                          onChange={(e) =>
                            updateOption(index, "value", e.target.value)
                          }
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Label"
                          value={option.label || ""}
                          onChange={(e) =>
                            updateOption(index, "label", e.target.value)
                          }
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Order"
                        value={option.sortOrder || 0}
                        onChange={(e) =>
                          updateOption(
                            index,
                            "sortOrder",
                            Number(e.target.value),
                          )
                        }
                        className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                      <button
                        onClick={() => removeOption(index)}
                        className="text-red-600 hover:text-red-900 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
