ALTER TABLE public.exam_cycles ADD COLUMN exam_start_date date;
COMMENT ON COLUMN public.exam_cycles.exam_start_date IS 'Earliest known exam day (machine-readable, from exam_date evidence). Used to reject videos published before the exam.';
UPDATE public.exam_cycles SET exam_start_date = DATE '2018-05-29' WHERE label = '2018 recruitment';
UPDATE public.exam_cycles SET exam_start_date = DATE '2019-05-19' WHERE label = '2019 recruitment';
UPDATE public.exam_cycles SET exam_start_date = DATE '2021-01-01' WHERE label = '2020 recruitment → 2021 exam';
UPDATE public.exam_cycles SET exam_start_date = DATE '2022-04-01' WHERE label = '2022 recruitment';
UPDATE public.exam_cycles SET exam_start_date = DATE '2024-06-05' WHERE label = '2024 recruitment (Advt. 1/2024)';