"""
Every input of the HaulOS pricing model, with where it came from.

Each input is one row on the Assumptions sheet. `conf` is one of High, Med, Low
or ASSUMPTION. A published price read on the vendor's own page is High; a value
nobody has measured is ASSUMPTION, however reasonable it looks.

Derived rows are formulas over the inputs, written with {key} placeholders. They
sit on the same sheet so the fallback for every missing actual is in one place.
"""

READ = '2026-10-04'

TW_VOICE = f'twilio.com/en-us/voice/pricing/us, read {READ} (page dated August 2026)'
TW_SMS = f'twilio.com/en-us/sms/pricing/us, read {READ} (page dated September 2026)'
TW_A2P = f'Twilio help article 1260803965530 (A2P 10DLC fees), read {READ}'
ZOHO_CRM = f'zoho.com/en-us/crm/zohocrm-pricing.html and comparison page, read {READ}, annual billing'
ZOHO_API = f'zoho.com/crm/developer/docs/api/v8/api-limits.html, read {READ}'
ZOHO_VOICE = f'zoho.com/voice/pricing.html, read {READ}'
ZOHO_MA = f'zoho.com/marketingautomation/pricing.html and sms-pricing.html, read {READ}'
SENDBLUE = f'sendblue.com/pricing and docs.sendblue.com/limits, read {READ}'
FORGE = f'laravel.com/forge/pricing, read {READ}'
AWS = f'AWS price feed for us-east-1 (published 2026-09-25), read {READ}'
AZURE = f'azure.microsoft.com pricing pages, East US, read {READ}'
CLAUDE = f'platform.claude.com/docs/en/about-claude/pricing, read {READ}'
NETLIFY = f'netlify.com/pricing and billing docs, read {READ}'
FMCSA = f'FMCSA dataset 6eyk-hxee on data.transportation.gov, counted {READ}'
BRIEF = 'Starting hypothesis in the brief'
NONE = 'Nothing measured'


def I(key, label, value, unit, fmt, source, conf, note=''):
    return dict(kind='input', key=key, label=label, value=value, unit=unit, fmt=fmt,
                source=source, conf=conf, note=note)


def D(key, label, formula, unit, fmt, note=''):
    return dict(kind='derived', key=key, label=label, formula=formula, unit=unit, fmt=fmt,
                source='Formula', conf='', note=note)


SECTIONS = [
    ('Market', [
        I('mkt_brokers', 'Active household-goods broker authorities', 901, 'firms', 'int',
          f"{FMCSA}: broker_stat='A' AND hhg_chk='Y'", 'Med',
          'The count is exact. What the household-goods flag means is not fully confirmed.'),
        I('mkt_brokers_high', 'Broker count, high case', 1256, 'firms', 'int',
          'FMCSA 2024 notice, as given in the brief; not re-read', 'Med'),
        I('mkt_carriers', 'Household-goods carriers', 4000, 'firms', 'int',
          'Figure given in the brief ("roughly 4,000", older)', 'Low',
          'The dataset counts 8,596 active carrier authorities with the flag: see the next row.'),
        I('mkt_carriers_ds', 'Carrier count, dataset upper bound', 8596, 'firms', 'int',
          f"{FMCSA}: hhg_chk='Y' AND (common_stat='A' OR contract_stat='A')", 'Low',
          'An authority that covers household goods, not proof the firm moves households.'),
        I('mkt_overlap', 'Firms that are both broker and carrier', 237, 'firms', 'int', FMCSA, 'Med'),
        I('mkt_case', 'Market case: 1 brokers, 2 brokers high, 3 brokers + carriers, 4 brokers + carriers (dataset)',
          1, 'switch', 'int', 'Choice', 'ASSUMPTION'),
        D('addressable', 'Addressable firms, selected case',
          'CHOOSE({mkt_case},{mkt_brokers},{mkt_brokers_high},{mkt_brokers}+{mkt_carriers}-{mkt_overlap},'
          '{mkt_brokers}+{mkt_carriers_ds}-{mkt_overlap})', 'firms', 'int'),
        I('pen_low', 'Share of addressable firms at month 24, low', 0.02, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('pen_base', 'Share of addressable firms at month 24, base', 0.05, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('pen_high', 'Share of addressable firms at month 24, high', 0.10, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('ramp_exp', 'Ramp shape', 1.5, 'exponent', 'num', NONE, 'ASSUMPTION',
          '1 is a straight line to month 24. Higher starts slower.'),
        I('start_tenants', 'Tenants today', 1, 'tenants', 'int', 'The first client is live', 'High'),
        I('churn_m', 'Tenants lost per month', 0.015, '%', 'pct', NONE, 'ASSUMPTION',
          'Only changes how many new tenants are needed, and so the one-time fees.'),
    ]),
    ('Prices', [
        I('p_platform', 'Platform fee', 349, '$ / tenant / month', 'usd', f'{BRIEF} (test $299 to $499)', 'ASSUMPTION'),
        I('p_dialer', 'Dialer add-on', 79, '$ / seat / month', 'usd', BRIEF, 'ASSUMPTION'),
        I('incl_min', 'Minutes included with a dialer seat', 1200, 'minutes / seat / month', 'int', BRIEF, 'ASSUMPTION',
          'Counted as phone minutes, outbound plus inbound.'),
        I('over_mult', 'Overage price as a multiple of cost', 2.5, 'x', 'num', BRIEF, 'ASSUMPTION'),
        I('bill_over', 'Overage is charged: 1 yes, 0 no', 1, 'switch', 'int', 'Choice', 'ASSUMPTION'),
        I('p_sms', 'SMS add-on', 49, '$ / tenant / month', 'usd', BRIEF, 'ASSUMPTION'),
        I('incl_seg', 'Segments included with the SMS add-on', 1000, 'segments / month', 'int', BRIEF, 'ASSUMPTION',
          'Outbound segments.'),
        I('sms_setup', 'SMS setup fee', 399, '$ one-time', 'usd', BRIEF, 'ASSUMPTION'),
        I('p_comp', 'Compliance module', 79, '$ / tenant / month', 'usd', BRIEF, 'ASSUMPTION'),
        I('p_ai', 'AI SMS add-on', 249, '$ / tenant / month', 'usd', f'{BRIEF} (a test price)', 'ASSUMPTION'),
        I('p_onboard', 'Platform setup fee', 0, '$ one-time', 'usd', 'Not in the brief', 'ASSUMPTION',
          'Set above zero to model a setup fee.'),
        I('bundle_disc', 'Discount on a bundle', 0, '%', 'pct', 'Not in the brief', 'ASSUMPTION'),
        I('att_dialer', 'Tenants that take the dialer', 0.60, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('att_sms', 'Tenants that take SMS', 0.50, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('att_comp', 'Tenants that take compliance', 0.40, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('att_ai', 'Tenants that take AI SMS', 0.20, '%', 'pct', BRIEF, 'ASSUMPTION'),
        I('zoho_margin', 'Kore margin on Zoho licenses', 0, '%', 'pct',
          'Partner application in progress. Zoho publishes no reseller margin', 'ASSUMPTION',
          'One third-party page says 15% to 25% (Low confidence).'),
        I('target_gm', 'Gross-margin target', 0.70, '%', 'pct', NONE, 'ASSUMPTION',
          'Used only for the breakeven lines.'),
    ]),
    ('Tenant shape', [
        I('seats', 'Seats per tenant', 4, 'seats', 'int', BRIEF, 'ASSUMPTION',
          'The first client has 2 Zoho Voice users (seen 2026-09-30).'),
        I('nums_per_seat', 'Phone numbers per seat', 1, 'numbers', 'int', NONE, 'ASSUMPTION', 'A direct line per rep.'),
        I('nums_shared', 'Shared phone numbers per tenant', 1, 'numbers', 'int', NONE, 'ASSUMPTION', 'The main line.'),
        I('leads_per_seat', 'New leads per seat per month', 100, 'leads', 'int', NONE, 'ASSUMPTION'),
        D('d_leads', 'New leads per tenant per month', '{seats}*{leads_per_seat}', 'leads', 'int'),
    ]),
    ('Calling: what a seat does', [
        I('workdays', 'Working days a month', 21, 'days', 'int', NONE, 'ASSUMPTION'),
        I('att_day', 'Outbound dial attempts per seat per day', 60, 'attempts', 'int', NONE, 'ASSUMPTION',
          'The biggest unknown in the model.'),
        I('sh_person', 'Attempts answered by a person', 0.20, '%', 'pct', NONE, 'ASSUMPTION'),
        I('sh_vm', 'Attempts answered by voicemail', 0.35, '%', 'pct', NONE, 'ASSUMPTION'),
        D('sh_unans', 'Attempts not answered', '1-{sh_person}-{sh_vm}', '%', 'pct'),
        I('min_person', 'Billed minutes when a person answers', 4, 'minutes', 'num', NONE, 'ASSUMPTION',
          'Each call is rounded up to a whole minute.'),
        I('min_vm', 'Billed minutes when voicemail answers', 1, 'minutes', 'num', NONE, 'ASSUMPTION'),
        I('min_ring', 'Browser-leg minutes billed on an unanswered attempt', 1, 'minutes', 'num',
          'Code: no answerOnBridge on the dial (src/routes/voice.js)', 'ASSUMPTION',
          'UNVERIFIED against a bill. Set to 0 if ring time turns out to be free.'),
        I('in_day', 'Inbound calls per seat per day', 8, 'calls', 'int', NONE, 'ASSUMPTION'),
        I('in_ans', 'Inbound calls answered', 0.80, '%', 'pct', NONE, 'ASSUMPTION'),
        I('min_in', 'Billed minutes per answered inbound call', 4, 'minutes', 'num', NONE, 'ASSUMPTION'),
        I('min_in_unans', 'Billed inbound minutes on an unanswered inbound call', 1, 'minutes', 'num',
          'Code: no answerOnBridge (src/routes/inbound.js)', 'ASSUMPTION', 'UNVERIFIED against a bill.'),
        I('rec_out', 'Outbound calls are recorded: 1 yes, 0 no', 1, 'switch', 'int',
          "Code: record-from-answer on every outbound call (src/routes/voice.js:21)", 'High'),
        I('rec_in', 'Inbound calls are recorded: 1 yes, 0 no', 0, 'switch', 'int',
          'Code: no record on the inbound dial (src/routes/inbound.js:21)', 'High'),
        I('retention', 'Months a recording is kept', 12, 'months', 'int', NONE, 'ASSUMPTION',
          'The code never deletes a recording. 12 assumes a retention rule is added.'),
        I('amd_on', 'Answering machine detection: 1 on, 0 off', 0, 'switch', 'int',
          'Code: not used anywhere in src/', 'High', 'The planned auto dialer would turn this on.'),
        I('band', 'Low and high band when there are under 3 months of data', 0.5, '%', 'pct',
          'Rule in the brief', 'High'),
        D('d_attempts', 'Outbound attempts per seat per month', '{workdays}*{att_day}', 'calls', 'int'),
        D('d_out_min', 'Billed minutes, PSTN outbound, per seat',
          '{d_attempts}*({sh_person}*{min_person}+{sh_vm}*{min_vm})', 'minutes', 'int'),
        D('d_in_calls', 'Inbound calls per seat per month', '{workdays}*{in_day}', 'calls', 'int'),
        D('d_in_min', 'Billed minutes, PSTN inbound, per seat',
          '{d_in_calls}*({in_ans}*{min_in}+(1-{in_ans})*{min_in_unans})', 'minutes', 'int'),
        D('d_browser_min', 'Billed minutes, browser leg, per seat',
          '{d_out_min}+{d_attempts}*{sh_unans}*{min_ring}+{d_in_calls}*{in_ans}*{min_in}', 'minutes', 'int'),
        D('d_rec_min', 'Recorded minutes per seat',
          '{d_out_min}*{rec_out}+{d_in_calls}*{in_ans}*{min_in}*{rec_in}', 'minutes', 'int'),
        D('d_calls', 'Calls per seat per month', '{d_attempts}+{d_in_calls}', 'calls', 'int'),
        D('d_amd', 'Answering-machine-detection calls per seat', '{d_attempts}*{amd_on}', 'calls', 'int'),
    ]),
    ('Texting: what a tenant sends', [
        I('texts_per_lead', 'Automated texts per lead', 6, 'texts', 'num', NONE, 'ASSUMPTION'),
        I('seg_per_text', 'Segments per automated text', 1.6, 'segments', 'num', NONE, 'ASSUMPTION',
          'A text with a signature line usually runs past 160 characters.'),
        I('manual_day', 'Texts an agent types per day', 10, 'texts', 'num', NONE, 'ASSUMPTION'),
        I('seg_manual', 'Segments per typed text', 1.3, 'segments', 'num', NONE, 'ASSUMPTION'),
        I('reply_rate', 'Leads that reply', 0.25, '%', 'pct', NONE, 'ASSUMPTION'),
        I('in_per_reply', 'Inbound messages per replying lead', 2, 'messages', 'num', NONE, 'ASSUMPTION'),
        D('d_seg_out', 'Outbound segments per tenant per month',
          '{d_leads}*{texts_per_lead}*{seg_per_text}+{seats}*{workdays}*{manual_day}*{seg_manual}', 'segments', 'int'),
        D('d_seg_in', 'Inbound segments per tenant per month', '{d_leads}*{reply_rate}*{in_per_reply}',
          'segments', 'int'),
    ]),
    ('AI SMS: what a tenant uses', [
        I('ai_turns', 'AI replies per conversation', 4, 'turns', 'num', NONE, 'ASSUMPTION'),
        I('tok_in', 'Input tokens per AI reply', 3500, 'tokens', 'int', NONE, 'ASSUMPTION',
          'Instructions plus the thread so far.'),
        I('tok_out', 'Output tokens per AI reply', 300, 'tokens', 'int', NONE, 'ASSUMPTION'),
        D('d_ai_convos', 'AI conversations per tenant per month', '{d_leads}*{reply_rate}', 'conversations', 'int'),
        D('d_sb_contacts', 'New inbound contacts per day', '{d_ai_convos}/30', 'contacts / day', 'num'),
    ]),
    ('Twilio Programmable Voice, US', [
        I('tw_out', 'Outbound to a US number', 0.0140, '$ / minute', 'usd4', TW_VOICE, 'High'),
        I('tw_in', 'Inbound on a local number', 0.0085, '$ / minute', 'usd4', TW_VOICE, 'High'),
        I('tw_client', 'Browser (Voice SDK) leg', 0.0040, '$ / minute', 'usd4', TW_VOICE, 'High',
          'Billed on top of the phone leg. Each leg rounds up to a minute.'),
        I('tw_rec', 'Call recording', 0.0025, '$ / minute', 'usd4', TW_VOICE, 'High'),
        I('tw_store', 'Recording storage', 0.0005, '$ / minute / month', 'usd4', TW_VOICE, 'High',
          'No free allotment is stated on the page.'),
        I('tw_num', 'Local number', 1.15, '$ / month', 'usd', TW_VOICE, 'High'),
        I('tw_amd', 'Answering machine detection', 0.0075, '$ / call', 'usd4', TW_VOICE, 'High'),
    ]),
    ('Twilio Messaging and 10DLC, US', [
        I('tw_sms_out', 'Outbound SMS', 0.0083, '$ / segment', 'usd4', TW_SMS, 'High',
          'One flat rate. No volume tiers are published.'),
        I('tw_sms_in', 'Inbound SMS', 0.0083, '$ / segment', 'usd4', TW_SMS, 'High'),
        I('tw_car_out', 'Carrier fee, outbound, blended', 0.0044, '$ / segment', 'usd4', TW_SMS, 'Med',
          'Rates are published: AT&T $0.0035, T-Mobile $0.0045, Verizon $0.005, US Cellular $0.005, '
          'others $0.0042. The blend is an ASSUMPTION (Verizon 35%, T-Mobile 33%, AT&T 28%, others 4%).'),
        I('tw_car_in', 'Carrier fee, inbound, blended', 0.0018, '$ / segment', 'usd4', TW_SMS, 'Med',
          'AT&T $0.0035, T-Mobile and US Cellular $0.0025, none listed for Verizon. Same blend.'),
        I('tw_brand', '10DLC brand registration', 4.50, '$ one-time', 'usd', TW_A2P, 'High',
          'Low-volume standard brand. A standard brand is $46.'),
        I('tw_vet', '10DLC campaign vetting', 15, '$ one-time', 'usd', TW_A2P, 'High'),
        I('tw_camp_mo', '10DLC campaign fee', 1.50, '$ / month', 'usd', TW_A2P, 'High',
          'Low-volume mixed campaign, capped at 2,000 segments a day to T-Mobile. A standard campaign is $10.'),
        I('sms_nums', 'Texting numbers per tenant', 1, 'numbers', 'int', NONE, 'ASSUMPTION'),
    ]),
    ('Zoho', [
        I('zc_pro', 'Zoho CRM Professional', 23, '$ / user / month', 'usd', ZOHO_CRM, 'High'),
        I('zc_ent', 'Zoho CRM Enterprise', 40, '$ / user / month', 'usd', ZOHO_CRM, 'High'),
        I('zc_ult', 'Zoho CRM Ultimate', 52, '$ / user / month', 'usd', ZOHO_CRM, 'High'),
        I('zc_edition', 'Edition a tenant runs: 1 Professional, 2 Enterprise, 3 Ultimate', 2, 'switch', 'int',
          NONE, 'ASSUMPTION',
          "The first client's 53,000-credit allowance (seen 2026-10-01) fits Enterprise with 3 users."),
        D('zc_list', 'Zoho CRM list price, selected edition', 'CHOOSE({zc_edition},{zc_pro},{zc_ent},{zc_ult})',
          '$ / user / month', 'usd'),
        I('api_base', 'API credits a day, base', 50000, 'credits', 'int', ZOHO_API, 'High'),
        I('api_user_pro', 'API credits a day per user, Professional', 500, 'credits', 'int', ZOHO_API, 'High'),
        I('api_user_ent', 'API credits a day per user, Enterprise', 1000, 'credits', 'int', ZOHO_API, 'High'),
        I('api_user_ult', 'API credits a day per user, Ultimate', 2000, 'credits', 'int', ZOHO_API, 'High'),
        D('api_allow', 'API credits a day, tenant allowance',
          '{api_base}+CHOOSE({zc_edition},{api_user_pro},{api_user_ent},{api_user_ult})*{seats}', 'credits', 'int'),
        I('credits_per_call', 'API credits per logged call', 4, 'credits', 'num',
          'Counted from the code: a search (1) and an insert (1), on two log paths. Weights from ' + ZOHO_API,
          'Med', '2 if a call is only logged once.'),
        I('zv_user', 'Zoho Voice, per user', 34, '$ / user / month', 'usd', ZOHO_VOICE, 'High',
          'Enterprise Telephony Basic, annual billing, with unlimited US and Canada calling.'),
        I('zv_power', 'Zoho Voice power dialer add-on', 10, '$ / user / month', 'usd', ZOHO_VOICE, 'High'),
        I('zv_auto', 'Zoho Voice auto dialer', 10, '$ / user / month', 'usd',
          'Zoho publishes no auto dialer (progressive or predictive) price', 'ASSUMPTION',
          'Set to the power dialer add-on, the nearest listed item.'),
        I('zma_plan', 'Zoho Marketing Automation plan', 33, '$ / month', 'usd', ZOHO_MA, 'High',
          'Standard, 5,000 contacts, annual billing.'),
        I('zma_sms', 'Zoho Marketing Automation, per US text', 0.012, '$ / text', 'usd4', ZOHO_MA, 'Med',
          'Derived from the vendor calculator: 4 credits a text. $0.0096 on large credit packs.'),
        I('zma_fixed', 'Zoho Marketing Automation, number and 10DLC campaign', 11, '$ / month', 'usd', ZOHO_MA, 'High',
          '$1 long code plus $10 campaign fee.'),
    ]),
    ('SendBlue', [
        I('sb_line', 'Dedicated line, AI Agent plan', 100, '$ / line / month', 'usd', SENDBLUE, 'High',
          'Flat, no per-message fee, inbound-first. A SendBlue blog post (2026-04-09) says $29 for a '
          '"Starter plan" that is not on the pricing page.'),
        I('sb_lines', 'Lines per tenant', 1, 'lines', 'int', NONE, 'ASSUMPTION'),
        I('sb_limit', 'Inbound contacts allowed per line per day', 1000, 'contacts', 'int', SENDBLUE, 'High'),
    ]),
    ('AI model', [
        I('llm_in', 'Input tokens', 4, '$ / million tokens', 'usd', CLAUDE, 'High',
          'The top-tier model the client site uses for text replies. The small model is $1.'),
        I('llm_out', 'Output tokens', 20, '$ / million tokens', 'usd', CLAUDE, 'High', 'The small model is $5.'),
    ]),
    ('Hosting today: Laravel Forge and AWS EC2', [
        I('forge_plan', 'Forge subscription', 19, '$ / month', 'usd', FORGE, 'ASSUMPTION',
          'Prices are published (Hobby $12, Growth $19, Business $39). Which plan Kore is on is not known.'),
        I('ec2_inst', 'EC2 instance', 30.37, '$ / month', 'usd', AWS, 'ASSUMPTION',
          't3.medium at 730 hours. The instance type of dk-services is not known (t3.small $15.18, t3.large $60.74).'),
        I('ebs_gb', 'Disk', 30, 'GB', 'int', NONE, 'ASSUMPTION'),
        I('ebs_price', 'Disk price (gp3)', 0.08, '$ / GB / month', 'usd4', AWS, 'High'),
        I('ip_addr', 'Public IPv4 address', 3.65, '$ / month', 'usd', AWS, 'High'),
        I('host_alloc', 'Share of the shared server charged to HaulOS', 0.5, '%', 'pct', NONE, 'ASSUMPTION'),
        I('cap_srv', 'Tenants one server carries', 50, 'tenants', 'int', NONE, 'ASSUMPTION'),
    ]),
    ('Hosting at scale: Azure', [
        I('az_plan', 'App Service instance', 24.82, '$ / month', 'usd', AZURE, 'High',
          'Linux B2 (2 cores, 3.5 GB). Basic has no autoscale or deployment slots. P1v3 is $113.15.'),
        I('az_min', 'Instances, minimum', 1, 'instances', 'int', NONE, 'ASSUMPTION'),
        I('az_cap', 'Tenants one instance carries', 100, 'tenants', 'int', NONE, 'ASSUMPTION'),
        I('kv_price', 'Key Vault operations', 0.03, '$ / 10,000', 'usd4', AZURE, 'High'),
        I('kv_ops', 'Key Vault operations per tenant per month', 20000, 'operations', 'int', NONE, 'ASSUMPTION'),
        I('blob_price', 'Blob Storage, hot', 0.0208, '$ / GB / month', 'usd4', AZURE, 'High'),
        I('blob_gb', 'Blob Storage per tenant', 2, 'GB', 'num', NONE, 'ASSUMPTION'),
        I('tbl_price', 'Table Storage', 0.045, '$ / GB / month', 'usd4', AZURE, 'High'),
        I('tbl_gb', 'Table Storage per tenant', 0.5, 'GB', 'num', NONE, 'ASSUMPTION'),
        I('tbl_txn_price', 'Table Storage transactions', 0.00036, '$ / 10,000', 'usd6', AZURE, 'High'),
        I('tbl_txn', 'Table transactions per tenant per month', 200000, 'transactions', 'int', NONE, 'ASSUMPTION'),
        I('host_mode', 'Hosting: 1 Forge and AWS, 2 Azure, 3 Azure once tenants reach the number below',
          1, 'switch', 'int', 'Choice', 'ASSUMPTION'),
        I('host_switch_n', 'Tenant count that triggers the move to Azure', 25, 'tenants', 'int', NONE, 'ASSUMPTION'),
    ]),
    ('Client site (Netlify) and GitHub', [
        I('nf_site', 'Each tenant gets a hosted site and portal: 1 yes, 0 no', 1, 'switch', 'int', NONE, 'ASSUMPTION'),
        I('nf_plan', 'Netlify Pro', 20, '$ / month', 'usd', NETLIFY, 'High', 'Flat, shared by every site.'),
        I('nf_incl', 'Credits included', 3000, 'credits / month', 'int', NETLIFY, 'High'),
        I('nf_credit', 'Extra credits', 0.006667, '$ / credit', 'usd6', NETLIFY, 'High', '$10 per 1,500.'),
        I('nf_credits', 'Credits one tenant site uses', 9000, 'credits / month', 'int',
          'Prior observation, 2026-10-01: the Kore team used about 9,000 a month', 'Med',
          'About 80% was a database kept awake by every-minute schedules. Tenants sharing one database would cut this.'),
        I('gh_seat', 'GitHub plan', 0, '$ / user / month', 'usd', f'Org plan read {READ}: Free', 'High',
          'Team is $4 a user.'),
        I('gh_seats', 'GitHub seats', 1, 'users', 'int', f'Org read {READ}', 'High'),
    ]),
    ('Compliance module', [
        I('comp_cogs', 'Cost to serve', 1, '$ / tenant / month', 'usd', NONE, 'ASSUMPTION',
          'Software only: storing and delivering signed receipts and disclosures.'),
    ]),
]
