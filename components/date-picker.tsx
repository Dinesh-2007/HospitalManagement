"use client";

import React, { useState, useRef, useEffect } from "react";
import { CalenderIcon, ChevronLeftIcon, ArrowRightIcon } from "./icons";

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    className?: string;
}

export function DatePicker({ value, onChange, className = "" }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : new Date();
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateSelect = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const yyyy = newDate.getFullYear();
        const mm = String(newDate.getMonth() + 1).padStart(2, "0");
        const dd = String(newDate.getDate()).padStart(2, "0");
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const monthName = viewDate.toLocaleString("default", { month: "long" });

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
        }
        for (let d = 1; d <= totalDays; d++) {
            const isSelected =
                value === `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            days.push(
                <button
                    key={d}
                    type="button"
                    onClick={() => handleDateSelect(d)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${isSelected
                        ? "bg-brand-500 text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                >
                    {d}
                </button>
            );
        }

        return (
            <div className="p-3">
                <div className="mb-3 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {monthName} {year}
                    </span>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <ArrowRightIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <div key={d}>{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">{days}</div>
            </div>
        );
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Select date";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex min-w-[140px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
                <CalenderIcon className="h-4 w-4 text-gray-400" />
                <span>{formatDate(value)}</span>
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full z-[1000] mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    {renderCalendar()}
                </div>
            )}
        </div>
    );
}
