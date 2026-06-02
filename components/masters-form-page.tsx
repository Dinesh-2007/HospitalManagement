"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BlankPage } from "./blank-page";
import { columnNameFromFieldId, tableNameFromCardTitle } from "../lib/master-form-table";
import { PencilIcon, TrashBinIcon } from "./icons";

const HIDDEN_FIELD_NOTES = new Set([
  "character",
  "free text",
  "number",
  "date time",
  "date",
  "time",
  "lov",
  "yes / no",
  "from lov",
  "cash / cheque / rtgs / neft / online transfer",
  "10 digit only",
  "alphanumeric only",
  "positive numbers only",
]);

export type MastersFormField = {
  id: string;
  label: string;
  type:
    | "text"
    | "number"
    | "select"
    | "multiselect"
    | "checkbox"
    | "display"
    | "datetime-local"
    | "date"
    | "time"
    | "textarea";
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
  options?: string[];
  fullWidth?: boolean;
  size?: "small" | "medium" | "large" | "full";
  note?: string;
  colStart?: 1 | 2 | 3 | 4;
  onChange?: (value: string) => void;
};

type MastersFormPageProps = {
  title: string;
  cardTitle: string;
  description: string;
  fields: MastersFormField[];
  backButtonText?: string;
  backHref?: string;
  columns?: 1 | 2 | 3;
  children?: React.ReactNode;
};

type SavedRecord = Record<string, unknown>;
type FormValue = string | string[];

const fieldSizeClasses: Record<NonNullable<MastersFormField["size"]>, string> = {
  small: "w-full",
  medium: "w-full",
  large: "w-full",
  full: "w-full",
};

const fieldColumnClasses: Record<NonNullable<MastersFormField["size"]>, string> = {
  small: "",
  medium: "",
  large: "lg:col-span-2",
  full: "col-span-full",
};

const colStartClasses: Record<number, string> = {
  1: "lg:col-start-1",
  2: "lg:col-start-2",
  3: "lg:col-start-3",
  4: "lg:col-start-4",
};

function serializeFormValues(
  values: Record<string, FormValue>,
  fields: MastersFormField[],
): Record<string, string | string[]> {
  return fields.reduce<Record<string, string | string[]>>(
    (accumulator, field) => {
      if (field.type === "multiselect" || field.type === "checkbox") {
        accumulator[field.id] = Array.isArray(values[field.id]) ? values[field.id] : [];
        return accumulator;
      }

      accumulator[field.id] =
        typeof values[field.id] === "string" ? values[field.id] : "";
      return accumulator;
    },
    {},
  );
}

function buildInitialFormValues(fields: MastersFormField[]): Record<string, FormValue> {
  return fields.reduce<Record<string, FormValue>>((accumulator, field) => {
    accumulator[field.id] =
      field.type === "multiselect" || field.type === "checkbox" ? [] : "";
    return accumulator;
  }, {});
}

function normalizeRecordValue(value: unknown, field: MastersFormField): FormValue {
  if (field.type === "multiselect" || field.type === "checkbox") {
    if (Array.isArray(value)) {
      return value.map(String);
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return value ? [value] : [];
      }
    }

    return [];
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function MastersFormPage({
  title,
  cardTitle,
  description,
  fields,
  backButtonText = "Back to Masters",
  backHref = "/masters",
  columns,
  children,
}: MastersFormPageProps) {

  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShowingForm, setIsShowingForm] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, FormValue>>(() =>
    buildInitialFormValues(fields),
  );

  const tableName = tableNameFromCardTitle(cardTitle);
  const params = useParams();
  const hname = params?.Hname as string;

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);

    try {
      const response = await fetch(`/api/${hname}/forms/${tableName}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as {
        rows?: SavedRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load saved records.");
      }

      setRecords(data.rows ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load saved records.";
      setSubmitError(message);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [tableName, hname]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRecords]);

  // Avoid synchronously calling setState inside effects; form state is reset
  // via resetFormState or during editRecord.


  const resetFormState = useCallback(() => {
    setFormValues(buildInitialFormValues(fields));
    setEditingRecordId(null);
  }, [fields]);

  const updateFieldValue = useCallback(
    (field: MastersFormField, value: FormValue) => {
      setFormValues((current) => ({
        ...current,
        [field.id]: value,
      }));

      if (typeof value === "string") {
        field.onChange?.(value);
      }
    },
    [],
  );

  const handleEditRecord = useCallback(
    (record: SavedRecord) => {
      const nextValues = buildInitialFormValues(fields);

      for (const field of fields) {
        const recordValue =
          record[field.id] ?? record[columnNameFromFieldId(field.id)];
        nextValues[field.id] = normalizeRecordValue(recordValue, field);
      }

      setFormValues(nextValues);
      setEditingRecordId(Number(record.id));
      setSubmitError(null);
      setSubmitMessage(null);
      setIsShowingForm(true);
    },
    [fields],
  );

  const handleDeleteRecord = useCallback(
    async (recordId: number) => {
      setSubmitError(null);
      setSubmitMessage(null);

      try {
        const response = await fetch(`/api/${hname}/forms/${tableName}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: recordId }),
        });

        const data = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to delete record.");
        }

        if (editingRecordId === recordId) {
          resetFormState();
        }

        setSubmitMessage("Record deleted successfully.");
        await loadRecords();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete record.";
        setSubmitError(message);
      }
    },
    [editingRecordId, hname, loadRecords, resetFormState, tableName],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    const values = serializeFormValues(formValues, fields);

    try {
      const response = await fetch(`/api/${hname}/forms/${tableName}`, {
        method: editingRecordId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingRecordId,
          cardTitle,
          fields,
          values,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save form values.");
      }

      resetFormState();
      setSubmitMessage(
        editingRecordId
          ? `Updated successfully in ${tableName}.`
          : `Saved successfully to ${tableName}.`,
      );
      await loadRecords();
      setIsShowingForm(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save form values.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const recordColumns = Object.keys(records[0] ?? {});
  const standardFieldCount = fields.filter((field) => !field.fullWidth).length;
  // Determine column count based on explicit prop or field count
  const shouldUseThreeColumns = columns === 3 || (columns === undefined && standardFieldCount >= 6);
  const gridColumnsClass = columns === 1 
    ? "lg:grid-cols-1" 
    : shouldUseThreeColumns 
      ? "lg:grid-cols-3" 
      : "lg:grid-cols-2";

  return (
    <BlankPage title={title}>
      <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              {cardTitle}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsShowingForm((current) => !current)}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
          >
            {isShowingForm ? "View Records" : "View Form"}
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {isShowingForm ? (
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div
                className={`grid grid-flow-dense grid-cols-1 items-start gap-4 ${gridColumnsClass}`}
              >
                {fields.map((field) => {
                  const helperText = field.note ?? field.hint;
                  const shouldShowHelperText =
                    helperText &&
                    !HIDDEN_FIELD_NOTES.has(helperText.trim().toLowerCase());
                  const fieldSize = field.size ?? (field.fullWidth ? "full" : "medium");
                  const fieldSizeClass = fieldSizeClasses[fieldSize];
                  const fieldColumnClass = field.fullWidth
                    ? fieldColumnClasses.full
                    : fieldColumnClasses[fieldSize];
                  const colStartClass = field.colStart ? colStartClasses[field.colStart] : "";

                  return (
                    <div
                      key={field.id}
                      className={`${fieldColumnClass} ${fieldSizeClass} ${colStartClass}`}
                    >
                      <label
                        htmlFor={field.id}
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {field.label}
                      </label>

                      {field.type === "select" ? (
                        <select
                          id={field.id}
                          name={field.id}
                          value={typeof formValues[field.id] === "string" ? formValues[field.id] : ""}
                          onChange={(e) => updateFieldValue(field, e.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        >
                          <option value="" disabled>
                            Select {field.label}
                          </option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "multiselect" ? (
                        <select
                          id={field.id}
                          name={field.id}
                          multiple
                          value={Array.isArray(formValues[field.id]) ? formValues[field.id] : []}
                          onChange={(e) =>
                            updateFieldValue(
                              field,
                              Array.from(e.target.selectedOptions, (option) => option.value),
                            )
                          }
                          className="min-h-28 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "checkbox" ? (
                        <div className="space-y-2">
                          {(field.options ?? []).map((option) => (
                            <label
                              key={option}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                name={field.id}
                                value={option}
                                checked={
                                  Array.isArray(formValues[field.id]) &&
                                  formValues[field.id].includes(option)
                                }
                                onChange={(e) => {
                                  const currentValues = Array.isArray(formValues[field.id])
                                    ? formValues[field.id]
                                    : [];
                                  const nextValues = e.target.checked
                                    ? [...currentValues, option]
                                    : currentValues.filter((current) => current !== option);
                                  updateFieldValue(field, nextValues);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : field.type === "textarea" ? (
                        <textarea
                          id={field.id}
                          name={field.id}
                          rows={4}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          value={typeof formValues[field.id] === "string" ? formValues[field.id] : ""}
                          onChange={(e) => updateFieldValue(field, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                        />
                      ) : (
                        <input
                          id={field.id}
                          name={field.id}
                          type={field.type === "display" ? "text" : field.type}
                          placeholder={field.placeholder}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          maxLength={field.maxLength}
                          pattern={field.pattern}
                          inputMode={field.inputMode}
                          readOnly={field.type === "display"}
                          value={typeof formValues[field.id] === "string" ? formValues[field.id] : ""}
                          onChange={(e) => {
                            if (field.pattern === "[a-zA-Z\\s]*") {
                              e.target.value = e.target.value.replace(
                                /[^a-zA-Z\s]/g,
                                "",
                              );
                            } else if (
                              field.pattern === "[0-9]*" ||
                              field.pattern === "[0-9]{10}" ||
                              field.pattern === "[0-9]{6}"
                            ) {
                              e.target.value = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                              );
                            } else if (field.pattern === "[a-zA-Z0-9]*") {
                              e.target.value = e.target.value.replace(
                                /[^a-zA-Z0-9]/g,
                                "",
                              );
                            }
                            updateFieldValue(field, e.target.value);
                          }}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                        />
                      )}

                      {shouldShowHelperText ? (
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-gray-400">
                          {helperText}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {children && (
                <div className="mt-8">
                  {children}
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href={backHref}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {backButtonText}
                </Link>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="reset"
                    onClick={resetFormState}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {editingRecordId ? "Cancel Edit" : "Clear"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                  >
                    {isSubmitting ? "Saving..." : editingRecordId ? "Update" : "Submit"}
                  </button>
                </div>
              </div>

              {submitMessage ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {submitMessage}
                </p>
              ) : null}

              {submitError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                  Saved Records
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Latest entries stored in the{" "}
                  <span className="font-medium">{tableName}</span> table.
                </p>
              </div>

              {isLoadingRecords ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading saved records...
                </p>
              ) : records.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No records saved yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    <thead>
                      <tr>
                        {recordColumns.map((column) => (
                          <th
                            key={column}
                            className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                          >
                            {column.replace(/_/g, " ")}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {records.map((record, index) => (
                        <tr key={`${String(record.id ?? index)}-${index}`}>
                          {recordColumns.map((column) => {
                            const value = record[column];
                            const displayValue = Array.isArray(value)
                              ? value.join(", ")
                              : typeof value === "object" && value !== null
                                ? JSON.stringify(value)
                                : value;

                            return (
                              <td
                                key={`${index}-${column}`}
                                className="px-4 py-3 text-gray-700 dark:text-gray-300"
                              >
                                {displayValue === null ||
                                displayValue === undefined ||
                                displayValue === ""
                                  ? "-"
                                  : String(displayValue)}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditRecord(record)}
                                title="Edit record"
                                aria-label="Edit record"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-300 text-brand-600 transition hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const recordId = Number(record.id);
                                  if (Number.isInteger(recordId) && recordId > 0) {
                                    void handleDeleteRecord(recordId);
                                  }
                                }}
                                title="Delete record"
                                aria-label="Delete record"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-500/10"
                              >
                                <TrashBinIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </BlankPage>
  );
}
