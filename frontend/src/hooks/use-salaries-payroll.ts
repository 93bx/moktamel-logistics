import { useState, useEffect, useCallback } from 'react';
import { ListSalariesResponse, SalariesPayrollRow, CreateSalaryReceiptInput } from '@/lib/types/salaries-payroll';

export function useSalariesPayroll(options: {
  month: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const [data, setData] = useState<ListSalariesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        month: options.month,
        page: (options.page || 1).toString(),
        pageSize: (options.pageSize || 20).toString(),
      });
      if (options.status && options.status !== 'ALL') params.append('status', options.status);
      if (options.search) params.append('search', options.search);

      const res = await fetch(`/api/salaries-payroll?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch salaries payroll');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.month, options.status, options.search, options.page, options.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

export function useSalariesPayrollDetail(id: string | null) {
  const [data, setData] = useState<SalariesPayrollRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/salaries-payroll/${id}`);
      if (!res.ok) throw new Error('Failed to fetch employee payroll detail');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id, fetchDetail]);

  return { data, loading, error, refresh: fetchDetail };
}

export function useCreateSalaryReceipt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReceipt = async (payrollRunEmployeeId: string, input: CreateSalaryReceiptInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/salaries-payroll/${payrollRunEmployeeId}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to create salary receipt');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createReceipt, loading, error };
}

