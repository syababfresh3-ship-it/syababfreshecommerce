-- Delivery settings stored as app_settings key-value entries
insert into app_settings (key, value) values
  ('free_delivery_min', '80'),
  ('default_delivery_fee', '15'),
  ('delivery_slots', '[
    {"id":"today-10","day":"today","start":10,"end":14,"label":"10am – 2pm","lead_hours":2,"active":true},
    {"id":"today-14","day":"today","start":14,"end":18,"label":"2pm – 6pm","lead_hours":2,"active":true},
    {"id":"today-18","day":"today","start":18,"end":21,"label":"6pm – 9pm","lead_hours":2,"active":true},
    {"id":"tomorrow-8","day":"tomorrow","start":8,"end":12,"label":"8am – 12pm","lead_hours":0,"active":true},
    {"id":"tomorrow-12","day":"tomorrow","start":12,"end":16,"label":"12pm – 4pm","lead_hours":0,"active":true},
    {"id":"tomorrow-16","day":"tomorrow","start":16,"end":20,"label":"4pm – 8pm","lead_hours":0,"active":true}
  ]')
on conflict (key) do nothing;
